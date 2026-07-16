# 1. Uygulamanın çalışacağı ortamı ayarla
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

# 2. SDK ortamını al ve kodları derle
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["LeaveManagementAPI.csproj", "./"]
RUN dotnet restore "./LeaveManagementAPI.csproj"
COPY . .
WORKDIR "/src/."
RUN dotnet build "LeaveManagementAPI.csproj" -c Release -o /app/build

# 3. Yayınlanabilir dosyaları (publish) oluştur
FROM build AS publish
RUN dotnet publish "LeaveManagementAPI.csproj" -c Release -o /app/publish

# 4. Yayınlanan dosyaları çalışma ortamına kopyala ve ayağa kaldır
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "LeaveManagementAPI.dll"]