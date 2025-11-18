FROM node:18-alpine

WORKDIR /app

# Копіюємо package.json і встановлюємо залежності
COPY package*.json ./
RUN npm install

# Копіюємо весь код проекту
COPY . .

# Відкриваємо порт
EXPOSE 3000

# ЗМІНЕНО: Запускаємо main.js
CMD ["node", "main.js", "-h", "0.0.0.0", "-p", "3000", "-c", "lab6/uploads"]