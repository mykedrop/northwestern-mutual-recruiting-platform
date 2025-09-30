# Use official Node.js 18 image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN cd backend && npm ci --production

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Start the application
CMD ["node", "backend/server.js"]