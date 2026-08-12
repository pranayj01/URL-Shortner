FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

ENV NODE_ENV=production
ENV RUN_MIGRATIONS=true

EXPOSE 3000

CMD ["node", "src/start.js"]
