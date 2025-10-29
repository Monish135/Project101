FROM node:20-alpine AS build
WORKDIR /repo
COPY . .
RUN npm i -g pnpm && pnpm -v && pnpm -w i --ignore-scripts \
  && pnpm -F @mini/shared build \
  && pnpm -F @mini/server build \
  && pnpm -F @mini/reviewer build \
  && pnpm -F @mini/participant build

FROM nginx:1.27-alpine
COPY --from=build /repo/apps/reviewer/dist /usr/share/nginx/html/reviewer
COPY --from=build /repo/apps/participant/dist /usr/share/nginx/html/participant
COPY --from=build /repo/services/server/dist /app/server/dist
COPY --from=build /repo/services/server/package.json /app/server/
COPY --from=build /repo/node_modules /app/node_modules
COPY --from=build /repo/packages/shared/dist /app/packages/shared/dist

# Install Node for running the server
RUN apk add --no-cache nodejs npm

# Copy nginx config
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \
    echo '  listen 80;' >> /etc/nginx/conf.d/default.conf && \
    echo '  server_name _;' >> /etc/nginx/conf.d/default.conf && \
    echo '  location /ws {' >> /etc/nginx/conf.d/default.conf && \
    echo '    proxy_pass http://localhost:3000;' >> /etc/nginx/conf.d/default.conf && \
    echo '    proxy_http_version 1.1;' >> /etc/nginx/conf.d/default.conf && \
    echo '    proxy_set_header Upgrade $http_upgrade;' >> /etc/nginx/conf.d/default.conf && \
    echo '    proxy_set_header Connection "upgrade";' >> /etc/nginx/conf.d/default.conf && \
    echo '  }' >> /etc/nginx/conf.d/default.conf && \
    echo '  location /health { proxy_pass http://localhost:3000; }' >> /etc/nginx/conf.d/default.conf && \
    echo '  location /participant {' >> /etc/nginx/conf.d/default.conf && \
    echo '    alias /usr/share/nginx/html/participant;' >> /etc/nginx/conf.d/default.conf && \
    echo '    try_files $uri $uri/ /participant/index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    index index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '  }' >> /etc/nginx/conf.d/default.conf && \
    echo '  location / {' >> /etc/nginx/conf.d/default.conf && \
    echo '    root /usr/share/nginx/html/reviewer;' >> /etc/nginx/conf.d/default.conf && \
    echo '    try_files $uri $uri/ /index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    index index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '  }' >> /etc/nginx/conf.d/default.conf && \
    echo '}' >> /etc/nginx/conf.d/default.conf

WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=3000

# Create startup script
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'node /app/server/dist/index.js &' >> /start.sh && \
    echo 'nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

EXPOSE 80
CMD ["/start.sh"]

