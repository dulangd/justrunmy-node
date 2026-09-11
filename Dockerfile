FROM node:22-alpine
WORKDIR /app
COPY . /app
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "bootstrap.js"]
