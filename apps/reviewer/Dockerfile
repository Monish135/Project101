FROM node:20-alpine AS build
WORKDIR /repo
# Copy entire monorepo to allow workspace install
COPY . .
RUN npm i -g pnpm && pnpm -v && pnpm -w i --ignore-scripts && pnpm -F @mini/shared build && pnpm -F @mini/reviewer build

FROM nginx:1.27-alpine
COPY --from=build /repo/apps/reviewer/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

