FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --ignore-platform

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

COPY start.sh .
RUN chmod +x start.sh

EXPOSE 3000

CMD ["sh", "start.sh"]
