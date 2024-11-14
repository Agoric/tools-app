FROM node:20

WORKDIR /app

COPY . .

RUN <<-EOF
    #!/bin/bash

    set -o errexit -o nounset -o xtrace

    yarn install
    yarn build
EOF

ENV PORT=3000

EXPOSE $PORT

ENTRYPOINT [ "yarn", "start" ]
