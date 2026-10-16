FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=160
WORKDIR /app
RUN mkdir -p /data /app/payment-router /app/supabase/functions/_shared && chown -R node:node /data /app
COPY --chown=node:node payment-router/*.mjs ./payment-router/
COPY --chown=node:node supabase/functions/_shared/doku.ts supabase/functions/_shared/gateway-protocol.ts ./supabase/functions/_shared/
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node","-e","fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node","--experimental-strip-types","payment-router/server.mjs"]
