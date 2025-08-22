import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import express from 'express';
import Vacancy from './models/Vacancy';

import { Op } from 'sequelize';
import { sequelize } from './config/database';
import { extractSalaryNumber } from './utils/textParser';
import {
  apiId,
  apiHash,
  parseChannel,
  initTelegramClient
} from './services/telegramService';

dotenv.config()

// Express app setup
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const search = req.query.search as string;

    const normalize = (q: any): string[] =>
      q ? (Array.isArray(q) ? q : [q as string]) : [];

    const typeFilters = normalize(req.query.type);
    const experienceFilters = normalize(req.query.experience);
    const sphereFilters = normalize(req.query.sphere);
    const salaryFilters = normalize(req.query.salary);
    const freshnessFilters = normalize(req.query.freshness);

    const whereClause: any = {};

    if (search) {
      whereClause[Op.or] = [
        { text: { [Op.like]: `%${search}%` } },
        { position: { [Op.like]: `%${search}%` } },
        { sphere: { [Op.like]: `%${search}%` } }
      ];
    }

    if (typeFilters.length > 0) {
      whereClause.employmentType = { [Op.in]: typeFilters };
    }

    if (sphereFilters.length > 0) {
      whereClause.sphere = { [Op.in]: sphereFilters };
    }

    // --- Freshness filter in SQL ---
    if (freshnessFilters.length > 0) {
      const now = new Date();
      const conditions = [];

      for (const f of freshnessFilters) {
        if (f === 'today') {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          conditions.push({ createdAt: { [Op.gte]: start } });
        }
        if (f === '3days') {
          const d = new Date();
          d.setDate(now.getDate() - 3);
          conditions.push({ createdAt: { [Op.gte]: d } });
        }
        if (f === 'week') {
          const d = new Date();
          d.setDate(now.getDate() - 7);
          conditions.push({ createdAt: { [Op.gte]: d } });
        }
      }

      if (conditions.length > 0) {
        whereClause[Op.or] = [...(whereClause[Op.or] || []), ...conditions];
      }
    }

    // fetch from DB
    const { count, rows } = await Vacancy.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    // convert Sequelize models → plain objects
    let vacancies = rows.map(v => v.toJSON() as any);

    // --- Salary filter in JS ---
    if (salaryFilters.length > 0) {
      vacancies = vacancies.filter((vac: any) => {
        const num = extractSalaryNumber(vac.salary);
        if (!num) return false;

        return salaryFilters.some(range => {
          const [min, max] = range.split('-').map(Number);
          if (!isNaN(min) && !isNaN(max)) {
            return num >= min && num <= max;
          } else if (!isNaN(min)) {
            return num >= min;
          }
          return false;
        });
      });
    }

    res.json({
      vacancies,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalVacancies: count,
        hasMore: page * limit < count
      }
    });
  } catch (error) {
    console.error('Error fetching vacancies:', error);
    res.status(500).json({ error: 'Failed to fetch vacancies' });
  }
});

// parse for the vacancies
app.post('/parse', async (req, res) => {
  try {
    const channels = ['@comeinlena', '@comeindesign', '@work_editor'];
    const allVacancies = [];

    for (const channel of channels) {
      try {
        const channelVacancies = await parseChannel(channel);
        allVacancies.push(...channelVacancies);
      } catch (error) {
        console.error(`Failed to parse ${channel}:`, error);
      }
    }

    res.json({
      success: true,
      parsed: allVacancies.length,
      vacancies: allVacancies,
    });
  } catch (error) {
    console.error('Error during parsing:', error);
    res.status(500).json({ error: 'Failed to parse channels' });
  }
});

// Edit it
app.put('/edit/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const vacancy = await Vacancy.findByPk(id);
    if (!vacancy) return res.status(404).json({ error: 'Vacancy not found' });

    await vacancy.update(updates);
    res.json({ success: true, vacancy });
  } catch (error) {
    console.error('Error editing vacancy:', error);
    res.status(500).json({ error: 'Failed to edit vacancy' });
  }
});

// Delete vacancy
app.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const vacancy = await Vacancy.findByPk(id);
    if (!vacancy) return res.status(404).json({ error: 'Vacancy not found' });

    await vacancy.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting vacancy:', error);
    res.status(500).json({ error: 'Failed to delete vacancy' });
  }
});

// Function to run parsing logic directly (without HTTP request)
async function runParsingJob() {
  const channels = ['@comeinlena', '@comeindesign', '@work_editor'];
  const allVacancies = [];

  for (const channel of channels) {
    try {
      const channelVacancies = await parseChannel(channel);
      allVacancies.push(...channelVacancies);
    } catch (error) {
      console.error(`Failed to parse ${channel}:`, error);
    }
  }

  console.log(`[CRON] Parsed ${allVacancies.length} vacancies at ${new Date().toISOString()}`);
}

// Schedule job to run every hour
cron.schedule('0 * * * *', async () => {
  console.log('[CRON] Running hourly parsing job...');
  await runParsingJob();
});

// Initialize database and start server
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully');

    await sequelize.sync();
    console.log('Database synced successfully');

    if (apiId && apiHash) {
      await initTelegramClient();
    } else {
      console.warn('Telegram API credentials not provided. Add TELEGRAM_API_ID and TELEGRAM_API_HASH environment variables.');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

startServer();