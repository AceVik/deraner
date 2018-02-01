# Deraner
## Requirements
Docker and Docker Compose


## Run following commands (Linux, Mac)
```bash
cp -rfpP docker-compose.dev.yml docker-compose.yml
docker-compose down
docker-compose up -d --build

docker-compose exec app npm install
docker-compose exec app composer install

# Gulp script is buggy at time, thats why run 2 times.
docker-compose exec app gulp
docker-compose exec app gulp

docker-compose exec app bin/console doctrine:database:create
docker-compose exec app bin/console doctrine:schema:create
docker-compose exec app bin/console doctrine:query:sql "INSERT INTO templates (name, path) VALUES ('Ulmenstein', '')"
```
