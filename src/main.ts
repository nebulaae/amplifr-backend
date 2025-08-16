import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import Vacancy from './models/Vacancy';
import { Op } from 'sequelize';

import { sequelize } from './config/database';
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

// Routes
app.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Search functionality
    const search = req.query.search as string;

    // Filters
    const typeFilters = req.query.type ? (Array.isArray(req.query.type) ? req.query.type : [req.query.type]) : [];
    const experienceFilters = req.query.experience ? (Array.isArray(req.query.experience) ? req.query.experience : [req.query.experience]) : [];
    const sphereFilters = req.query.sphere ? (Array.isArray(req.query.sphere) ? req.query.sphere : [req.query.sphere]) : [];

    // Build where clause
    const whereClause: any = {};

    // Search in text, position, and sphere
    if (search) {
      whereClause[Op.or] = [
        { text: { [Op.like]: `%${search}%` } },
        { position: { [Op.like]: `%${search}%` } },
        { sphere: { [Op.like]: `%${search}%` } }
      ];
    }

    // Apply filters
    if (typeFilters.length > 0) {
      whereClause.employmentType = { [Op.in]: typeFilters };
    }

    if (sphereFilters.length > 0) {
      whereClause.sphere = { [Op.in]: sphereFilters };
    }

    // Experience filter (this would need to be parsed from text or salary)
    if (experienceFilters.length > 0) {
      const experienceConditions = experienceFilters.map(exp => {
        if (exp === 'Меньше года') {
          return { text: { [Op.like]: '%меньше года%' } };
        } else if (exp === '1-3 года') {
          return {
            text: {
              [Op.or]: [
                { [Op.like]: '%1-3 года%' },
                { [Op.like]: '%от 1%' },
                { [Op.like]: '%от 2%' }
              ]
            }
          };
        } else if (exp === 'От 5 лет') {
          return { text: { [Op.like]: '%от 5%' } };
        }
        return {};
      });

      if (experienceConditions.length > 0) {
        whereClause[Op.or] = [
          ...(whereClause[Op.or] || []),
          ...experienceConditions
        ];
      }
    }

    const { count, rows } = await Vacancy.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      vacancies: rows,
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