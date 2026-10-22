FROM golang:1.25-alpine AS build
WORKDIR /src
ARG KBOS_VERSION=dev
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags "-s -w -X github.com/nt-kb/kbos/internal/cli.Version=${KBOS_VERSION}" -o /kb ./cmd/kb

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=build /kb /usr/local/bin/kb
WORKDIR /vault
ENTRYPOINT ["kb"]
