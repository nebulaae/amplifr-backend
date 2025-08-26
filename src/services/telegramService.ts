// Enhanced telegramService.ts with ad filtering
import input from 'input';
import dotenv from 'dotenv';
import Vacancy from '../models/Vacancy';

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { parseVacancyText } from '../utils/textParser';

dotenv.config()

// Telegram client setup
export const apiId = parseInt(process.env.TELEGRAM_API_ID || '');
export const apiHash = process.env.TELEGRAM_API_HASH || '';
const stringSession = new StringSession(process.env.TELEGRAM_SESSION || '');

export let telegramClient: TelegramClient | null = null;

export async function initTelegramClient() {
    try {
        telegramClient = new TelegramClient(stringSession, apiId, apiHash, {
            connectionRetries: 5,
        });

        await telegramClient.start({
            phoneNumber: async () => await input.text('Enter your phone number: '),
            password: async () => await input.text('Enter your password: '),
            phoneCode: async () => await input.text('Enter the code you received: '),
            onError: (err) => console.log(err),
        });

        console.log('Telegram client initialized successfully');
        console.log('Session string:', telegramClient.session.save());
    } catch (error) {
        console.error('Error initializing Telegram client:', error);
    }
};

// Simple filter: if there are hashtags, it's probably a vacancy
function hasHashtags(text: string): boolean {
    return /#\w+/.test(text);
}

// Parse function with enhanced filtering
export async function parseChannel(channelUsername: string) {
    if (!telegramClient) {
        throw new Error('Telegram client not initialized');
    }
    try {
        const entity = await telegramClient.getEntity(channelUsername);
        const messages = await telegramClient.getMessages(entity, { limit: 50 });

        const vacancies = [];

        for (const message of messages) {
            if (message.text && message.text.length > 50) {
                // Super simple filter: if no hashtags, skip it
                if (!hasHashtags(message.text)) {
                    continue;
                }

                // Parse additional data from text
                const parsedData = parseVacancyText(message.text);

                const vacancy = {
                    channel: channelUsername,
                    text: message.text,
                    url: `https://t.me/${channelUsername.replace('@', '')}/${message.id}`,
                    position: parsedData.position,
                    employmentType: parsedData.employmentType,
                    salary: parsedData.salary,
                    sphere: parsedData.sphere,
                };

                // Check if vacancy already exists
                const existingVacancy = await Vacancy.findOne({
                    where: { url: vacancy.url }
                });

                if (!existingVacancy) {
                    await Vacancy.create(vacancy);
                    vacancies.push(vacancy);
                }
            }
        }
        return vacancies;
    } catch (error) {
        console.error(`Error parsing channel ${channelUsername}:`, error);
        throw error;
    };
};