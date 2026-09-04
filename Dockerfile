# Use official Node.js runtime as parent image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy root package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy client package files and install client dependencies
COPY client/package*.json ./client/
RUN npm install --prefix client

# Copy full application code
COPY . .

# Build Vite React client frontend for production
RUN npm run build --prefix client

# Expose server port 5000 (Hugging Face / Render / Railway port)
EXPOSE 7860
EXPOSE 5000

ENV PORT=7860
ENV NODE_ENV=production

# Start Node.js Express & Socket.IO server
CMD ["node", "server/index.js"]
