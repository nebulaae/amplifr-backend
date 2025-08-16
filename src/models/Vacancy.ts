import { Model, DataTypes } from "sequelize";
import { sequelize } from "../config/database";

// Vacancy model
interface VacancyAttributes {
    id?: number;
    channel: string;
    text: string;
    url: string;
    position?: string;
    employmentType?: string;
    salary?: string;
    sphere?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const Vacancy = sequelize.define<Model<VacancyAttributes>>('Vacancy', {
    channel: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    url: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    position: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    employmentType: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    salary: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    sphere: {
        type: DataTypes.STRING,
        allowNull: true,
    },
});

export default Vacancy;