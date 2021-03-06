# see https://github.com/cmaessen/docker-php-sendmail for more information

FROM php:7.2-fpm

RUN apt-get update && apt-get install gnupg -y && \
    apt-key adv --recv-keys --keyserver keyserver.ubuntu.com 0xF1656F24C74CD1D8 && \
    echo 'deb [arch=amd64,i386,ppc64el] http://mirror.rackspeed.de/mariadb.org/repo/10.2/debian stretch main' >> /etc/apt/sources.list && \
    echo 'deb-src http://mirror.rackspeed.de/mariadb.org/repo/10.2/debian stretch main' >> /etc/apt/sources.list

RUN apt-get install aptitude -y

RUN aptitude update && aptitude full-upgrade -y && \
    aptitude install curl wget zlib1g-dev libicu-dev g++ mysql-client unzip zsh git-core git vim w3m htop -y

RUN bash -c "$(wget https://raw.githubusercontent.com/robbyrussell/oh-my-zsh/master/tools/install.sh -O -)"

RUN docker-php-ext-install intl
#RUN docker-php-ext-install reflection
RUN docker-php-ext-install sockets
RUN docker-php-ext-install json
RUN docker-php-ext-install zip

RUN docker-php-ext-install pdo pdo_mysql

# install php redis ext
RUN pecl install -o -f redis && \
    rm -rf /tmp/pear && \
    docker-php-ext-enable redis

RUN docker-php-ext-install opcache

RUN pecl install apcu \
  && docker-php-ext-enable apcu

RUN pecl install xdebug \
    && echo "zend_extension=$(find /usr/local/lib/php/extensions/ -name xdebug.so)" > /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.remote_enable=on" >> /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.remote_autostart=off" >> /usr/local/etc/php/conf.d/xdebug.ini

RUN php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
RUN php -r "if (hash_file('SHA384', 'composer-setup.php') === '544e09ee996cdf60ece3804abc52599c22b1f40f4323403c44d44fdfdd586475ca9813a858088ffbc1f233e9b180f061') { echo 'Installer verified'; } else { echo 'Installer corrupt'; unlink('composer-setup.php'); } echo PHP_EOL;"
RUN php composer-setup.php
RUN php -r "unlink('composer-setup.php');"
RUN mv composer.phar /bin/composer

RUN curl -sL https://deb.nodesource.com/setup_9.x | bash -
RUN apt-get install -y nodejs
RUN apt-get install -y build-essential

WORKDIR /var/www/deraner
RUN cd /var/www/deraner

RUN npm cache clean --force
RUN npm install npm -g

RUN npm i gulp@^4.0.0 -g