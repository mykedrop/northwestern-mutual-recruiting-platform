# Northwestern Mutual Recruiting Platform - Railway Deployment
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm install
RUN cd backend && npm ci --only=production

# Copy application code
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Run migrations and start server
CMD ["sh", "-c", "cd backend && npm run migrate && npm start"]