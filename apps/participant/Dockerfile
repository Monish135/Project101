FROM node:20-alpine AS build
WORKDIR /repo
COPY . .
RUN npm i -g pnpm && pnpm -v && pnpm -w i --ignore-scripts && pnpm -F @mini/shared build && pnpm -F @mini/participant build

FROM nginx:1.27-alpine
COPY --from=build /repo/apps/participant/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

