FROM node:19-slim
COPY . .
RUN npm install
EXPOSE 8800
CMD ["npm", "run", "pwa" ,"--", "--port", "8800"]
