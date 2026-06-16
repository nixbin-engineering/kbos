FROM golang:1.25-alpine AS kb
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -o /kb ./cmd/kb

FROM node:22-alpine AS deps
WORKDIR /app
COPY web/package.json ./
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=kb /kb /usr/local/bin/kb
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV VAULT_PATH=/vault
ENV KB_BIN=/usr/local/bin/kb
CMD ["node", "server.js"]
