# ----------------------
# Build Stage
# ----------------------
FROM node:22-slim AS build

WORKDIR /app

# Copy only package files first to leverage Docker cache
COPY package*.json ./

# Force cache invalidation for npm ci
# Avoid cross-platform lockfile issues by removing it and doing a fresh install
RUN npm config set fetch-retry-maxtimeout 600000 \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 10000 \
    && rm -f package-lock.json \
    && npm install --no-audit --progress=false

# Copy the rest of the source code
COPY . .

# Build the frontend
RUN npm run build

# ----------------------
# Serve Stage
# ----------------------
FROM nginx:alpine

# Copy build output from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
