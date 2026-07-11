FROM node:20.20.0

#Ubicarse en el directorio
WORKDIR /app

#Copiar los archivos
COPY ["./src", "/app/"]

RUN ls

RUN npm install

#Exponer puerto en el host anfitrion
EXPOSE 3000

