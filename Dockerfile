FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY src/Bhasini.Core/Bhasini.Core.csproj src/Bhasini.Core/
COPY src/Bhasini.Web/Bhasini.Web.csproj src/Bhasini.Web/
RUN dotnet restore src/Bhasini.Web/Bhasini.Web.csproj
COPY src/ src/
RUN dotnet publish src/Bhasini.Web/Bhasini.Web.csproj -c Release -o /app/publish

FROM nginx:alpine
WORKDIR /usr/share/nginx/html
EXPOSE 5000
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/publish/wwwroot .
