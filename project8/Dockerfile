FROM node:14
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install
COPY . .
ENV GOOGLE_APPLICATION_CREDENTIALS='./cs493-proj8-docker-3-50b403ff317f.json'
ENV PORT=8000
EXPOSE ${PORT}
CMD ["npm", "start"]