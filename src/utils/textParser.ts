// utils/textParser.ts
export interface ParsedVacancyData {
    position?: string;
    employmentType?: string;
    salary?: string;
    sphere?: string;
}

export function parseVacancyText(text: string): ParsedVacancyData {
    const result: ParsedVacancyData = {};

    // Extract position (usually in bold at the beginning)
    const positionMatch = text.match(/\*\*(.*?)\*\*/);
    if (positionMatch) {
        result.position = positionMatch[1].trim();
    }

    // Extract employment type (удаленно, офис, гибрид)
    const employmentPatterns = [
        /удален[нао]/i,
        /офис/i,
        /гибрид/i,
        /remote/i,
        /office/i,
        /hybrid/i
    ];

    for (const pattern of employmentPatterns) {
        if (pattern.test(text)) {
            const match = text.match(pattern);
            if (match) {
                result.employmentType = match[0].toLowerCase();
                if (result.employmentType.includes('удален')) result.employmentType = 'Удаленно';
                if (result.employmentType.includes('офис')) result.employmentType = 'Офис';
                if (result.employmentType.includes('гибрид')) result.employmentType = 'Гибрид';
                break;
            }
        }
    }

    // Extract salary
    const salaryPatterns = [
        /(?:з\/п|зарплата|salary).*?(\d+(?:\s?\d+)*(?:\s?000)?.*?(?:руб|₽|rub|доллар|\$|евро|€))/i,
        /от\s+(\d+(?:\s?\d+)*(?:\s?000)?.*?(?:руб|₽|rub|доллар|\$|евро|€))/i,
        /до\s+(\d+(?:\s?\d+)*(?:\s?000)?.*?(?:руб|₽|rub|доллар|\$|евро|€))/i,
        /(\d+(?:\s?\d+)*(?:\s?000)?)\s*-\s*(\d+(?:\s?\d+)*(?:\s?000)?)\s*(?:руб|₽|rub)/i
    ];

    for (const pattern of salaryPatterns) {
        const match = text.match(pattern);
        if (match) {
            result.salary = match[0].trim();
            break;
        }
    }

    // Extract sphere from hashtags
    const hashtagMatch = text.match(/#([a-zA-Zа-яА-Я]+)/g);
    if (hashtagMatch) {
        const sphereKeywords = {
            'копирайтер': 'Копирайтинг',
            'копирайтинг': 'Копирайтинг',
            'редактор': 'Копирайтинг',
            'дизайн': 'Дизайн',
            'дизайнер': 'Дизайн',
            'маркетинг': 'Маркетинг',
            'маркетолог': 'Маркетинг',
            'смм': 'SMM',
            'it': 'IT',
            'программист': 'IT',
            'разработчик': 'IT',
            'менеджер': 'Менеджмент',
            'менеджмент': 'Менеджмент',
            'hr': 'HR',
            'продажи': 'Продажи',
            'финансы': 'Финансы',
            'реклама': 'Реклама и PR',
            'pr': 'Реклама и PR',
            'креатив': 'Креатив',
            'поддержка': 'Клиентский сервис и поддержка',
            'сервис': 'Клиентский сервис и поддержка'
        };

        for (const hashtag of hashtagMatch) {
            const tag = hashtag.replace('#', '').toLowerCase();
            if (sphereKeywords[tag]) {
                result.sphere = sphereKeywords[tag];
                break;
            }
        }
    }

    // If sphere not found in hashtags, try to find it in text
    if (!result.sphere && result.position) {
        const positionLower = result.position.toLowerCase();
        const sphereKeywords = {
            'копирайтер': 'Копирайтинг',
            'редактор': 'Копирайтинг',
            'дизайнер': 'Дизайн',
            'маркетолог': 'Маркетинг',
            'смм': 'SMM',
            'программист': 'IT',
            'разработчик': 'IT',
            'менеджер': 'Менеджмент',
            'hr': 'HR',
            'продажи': 'Продажи',
            'финансы': 'Финансы'
        };

        for (const [keyword, sphere] of Object.entries(sphereKeywords)) {
            if (positionLower.includes(keyword)) {
                result.sphere = sphere;
                break;
            }
        }
    }

    return result;
}