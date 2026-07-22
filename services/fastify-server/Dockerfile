FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY services/fastify-server ./services/fastify-server
RUN npm install
WORKDIR /app/services/fastify-server
CMD ["npm", "run", "dev"]
