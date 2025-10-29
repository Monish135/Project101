FROM node:20-alpine AS build
WORKDIR /repo
COPY . .
RUN npm i -g pnpm && pnpm -v && pnpm -w i --ignore-scripts \
  && pnpm -F @mini/shared build \
  && pnpm -F @mini/server build

FROM node:20-alpine
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo .
WORKDIR /repo/services/server
EXPOSE 3000
CMD ["node", "dist/index.js"]


