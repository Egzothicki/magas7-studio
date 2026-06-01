FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

# ffmpeg for re-encoding browser-recorded webm into X-ready mp4
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install

COPY . .

ENV NODE_ENV=production
ENV STUDIO_OUTPUT_DIR=/var/www/magas7.com/studio
EXPOSE 3000

CMD ["npm", "start"]
