FROM node:24-alpine AS web
WORKDIR /client

COPY ["client/package.json", "client/package-lock.json", "./"]
RUN npm ci

COPY client/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["TimesheetLite.csproj", "."]
RUN dotnet restore "TimesheetLite.csproj"

COPY . .
COPY --from=web /client/dist ./wwwroot
RUN dotnet publish "TimesheetLite.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 8080
EXPOSE 8443
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "TimesheetLite.dll"]
