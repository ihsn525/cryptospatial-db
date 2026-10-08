# db-inspector/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Expose port 5175 for Standalone DB Inspector UI
EXPOSE 5175

# Start Vite dev server
CMD ["npm", "run", "dev"]