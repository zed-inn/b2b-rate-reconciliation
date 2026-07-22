# build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY services/react-admin ./services/react-admin
RUN npm install
WORKDIR /app/services/react-admin
RUN npm run build

# serve via nginx
FROM nginx:alpine
COPY --from=builder /app/services/react-admin/dist /usr/share/nginx/html
# custom spa configuration
COPY services/react-admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
