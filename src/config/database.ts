import { Sequelize } from "sequelize";

// Database setup
export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'vacancies.sqlite',
  logging: false,
});