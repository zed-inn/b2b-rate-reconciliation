FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY services/mock-supplier-api ./services/mock-supplier-api
RUN npm install
WORKDIR /app/services/mock-supplier-api
CMD ["npm", "run", "dev"]
