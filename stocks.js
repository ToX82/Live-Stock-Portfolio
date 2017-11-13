(function() {
    var app = angular.module('liveStocksPortfolio', []);

    app.controller('StocksController', function($scope, $http, $interval, $filter) {
        portfolio = this;
        portfolio.defaultSettings = {
            'apikey': '',
            'marketOpen': 8,
            'marketClose': 19,
            'update': 60
        };

        // Get localStorage settings if set, otherwise use the defaults
        var settings = localStorage.getItem('settings');
        if (settings !== null) {
            portfolio.settings = JSON.parse(settings);
        } else {
            portfolio.settings = portfolio.defaultSettings;
        }

        /**
         * [Update setting values, and sets a new updateInterval if needed]
         * @param  {[string]} item setting name
         * @param  {[string]} value setting value
         * @return {[void]}  null
         */
        portfolio.updateSettings = function(item, value) {
            if (item !== 'apikey') {
                value = parseInt(value);
                if (isNaN(value)) {
                    value = portfolio.defaultSettings[item];
                }
            }
            portfolio.settings[item] = value;
            localStorage.setItem('settings', JSON.stringify(portfolio.settings));
            updateInterval = setUpdateInterval(portfolio.settings.update);
        };

        /**
         * Searching stocks on google finance...
         * @param  {[string]} value String to lookup on google finance
         * @return {[void]}  null
         */
        portfolio.searchStock = function(value) {
            if (value === '') {
                portfolio.foundStocks = [];
                portfolio.search = {};
                return false;
            }
            value = value.replace(' ', '+');
            $http({
                method: 'POST',
                url: 'proxy.php',
                data: {
                    url: 'https://finance.yahoo.com/_finance_doubledown/api/resource/searchassist;searchTerm=' + value
                }
            }).then(function (response) {
                var data = response.data.items;
                $scope.portfolio.foundStocks = [];
                $.each(data, function(index, item) {
                    $scope.portfolio.foundStocks.push({
                        sym: item.symbol,
                        name: item.name
                    });
                });
            });
        };

        /**
         * Adds a stock to the portfolio
         * @param  {[array]} newStock The stock we are going to add to our portfolio
         * @return {[void]}  null
         */
        portfolio.addStock = function(newStock) {
            var duplicate = false;
            if (portfolio.stocks !== []) {
                $.each(portfolio.stocks, function(index, stock) {
                    if (stock.sym === newStock.sym) {
                        duplicate = true;
                    }
                });
            }

            if (duplicate === false) {
                portfolio.stocks.push(newStock);
                $scope.portfolio.foundStocks = [];
                $scope.search = '';
                portfolio.dbWrite(portfolio.stocks);
                portfolio.updateStocks(newStock, portfolio.stocks.length - 1);
            }
        };

        /**
         * Removes a stock from the portfolio
         * @param  {[array]} stock Stock data
         * @return {[void]}  null
         */
        portfolio.removeStock = function(stock) {
            portfolio.stocks.splice(portfolio.stocks.indexOf(stock), 1);
            portfolio.dbWrite(portfolio.stocks);
        };

        /**
         * Grab a stock historic values
         * @param  {[string]} symbol Symbol to fetch
         * @param  {[string]} name Stock name
         * @return {[void]}  null
         */
        portfolio.fetchHistory = function(symbol, name) {
            resetChart();
            portfolio.history = [];
            portfolio.historyName = name;
            portfolio.history[0] = {
                day: 'aggiornamento',
                min: 'in',
                max: 'corso',
                close: '...'
            };

            $http({
                method: 'GET',
                url: 'https://www.alphavantage.co/query',
                params: {
                    'function': 'TIME_SERIES_DAILY_ADJUSTED',
                    'apikey': portfolio.settings.apikey,
                    'symbol': symbol,
                    'nocache': new Date().getTime()
                }
            }).then(function (response) {
                var values = response.data['Time Series (Daily)'];
                if (typeof values === 'undefined') {
                    console.log(new Date + ': Fetch fallito per ' + symbol);
                } else {
                    values = Object.keys(values).sort();
                    values = _.takeRight(values, 20);
                    for (var i = 0; i < 20; i++) {
                        var data = response.data['Time Series (Daily)'][values[i]];
                        var day = $filter('date')(values[i], 'dd.MM.yyyy');

                        // Generating values array...
                        portfolio.history[i - 1] = {
                            day: day,
                            close: data['4. close'],
                            min: data['3. low'],
                            max: data['2. high']
                        };

                        // Updating chart.js
                        updateLabels(day);
                        updateChart(0, data['3. low']);
                        updateChart(1, data['2. high']);
                        updateChart(2, data['4. close']);
                    }
                }
            });
        };

        /**
         * [Update stock's values]
         * @param  {[array]} stock Stock values
         * @param  {[array]} index Position in portfolio.stocks array
         * @return {[void]} null
         */
        portfolio.updateStocks = function(stock, index) {
            if (!stock) {
                stock = portfolio.stocks;
                $.each(portfolio.stocks, function(index, stock) {
                    portfolio.updateStock(stock, index);
                });
            } else {
                portfolio.updateStock(stock, index);
            }
        };

        portfolio.updateStock = function(stock, index) {
            $http({
                method: 'GET',
                url: 'https://www.alphavantage.co/query',
                params: {
                    'function': 'TIME_SERIES_DAILY_ADJUSTED',
                    'apikey': portfolio.settings.apikey,
                    'symbol': stock.sym,
                    'nocache': new Date().getTime()
                }
            }).then(function (response) {
                var values = response.data['Time Series (Daily)'];
                $('[data-sym="' + stock.sym + '"]').closest('tr').removeClass('outdated');

                if (typeof values === 'undefined') {
                    $('[data-sym="' + stock.sym + '"]').closest('tr').addClass('outdated');
                    $('.outdated-message').removeClass('hide');
                    console.log(new Date + ': Fetch fallito per ' + stock.name);
                } else {
                    // Make sure that we are seing the last records first...
                    values = Object.keys(values).sort().reverse();

                    var max = response.data['Time Series (Daily)'][values[0]]['2. high'];
                    var min = response.data['Time Series (Daily)'][values[0]]['3. low'];
                    var close = response.data['Time Series (Daily)'][values[1]]['4. close'];
                    var value = response.data['Time Series (Daily)'][values[0]]['4. close'];

                    // Updating values...
                    portfolio.stocks[index].value = value;
                    portfolio.stocks[index].change = (value - close).toFixed(4);
                    portfolio.stocks[index].changeP = ((value - close) / value * 100).toFixed(2);
                    portfolio.stocks[index].min = min;
                    portfolio.stocks[index].max = max;
                    portfolio.stocks[index].spread = ((max - min) / max * 100).toFixed(2);
                    portfolio.stocks[index].class = portfolio.getAlerts(stock);
                }
            });
        };

        portfolio.getAlerts = function(stock) {
            var style = '';
            var target = stock.target;
            var stopLoss = stock.stopLoss;

            if (stock.value >= target && target > 0) {
                if (stock.class === '') {
                    new Audio('assets/target.mp3').play();
                    target = parseFloat(target).toFixed(4);
                    portfolio.pushNotify(
                        stock.name + '\nTarget raggiunto: ' + stock.value +
                        '\nValore impostato: ' + target, 'target'
                    );
                }
                style = 'hasTarget';
            }
            if (stock.value <= stopLoss && stopLoss > 0) {
                if (stock.class === '') {
                    new Audio('assets/stoploss.mp3').play();
                    stopLoss = parseFloat(stopLoss).toFixed(4);
                    portfolio.pushNotify(
                        stock.name + '\nStop loss raggiunto: ' + stock.value +
                        '\nValore impostato: ' + stopLoss, 'stoploss'
                    );
                }
                style = 'hasLoss';
            }
            return style;
        };

        /**
         * [Target & Stop Loss push browser notifications]
         * @param  {[string]} text  Text to be shown in the notification
         * @param  {[string]} trend Notification's icon
         * @return {[void]} null
         */
        portfolio.pushNotify = function(text, trend) {
            Push.create('Live Stock Portfolio', {
                body: text,
                icon: {
                    x16: 'assets/' + trend + '.png',
                    x32: 'assets/' + trend + '.png'
                },
                timeout: 5000,
                onClick: function () {
                    window.focus();
                    this.close();
                }
            });
        };

        /**
         * Read portfolio from localStorage
         * @return {[array]} Stocks array
         */
        portfolio.dbRead = function() {
            var stocks = localStorage.getItem('portfolio');
            if (stocks === null) {
                return [];
            }
            stocks = JSON.parse(stocks);
            return _.sortBy(stocks, 'name');
        };

        /**
         * Writes the stocks portfolio to localStorage
         * @param  {[type]} stocks array of stocks to save
         * @return {[void]}        null
         */
        portfolio.dbWrite = function(stocks) {
            localStorage.setItem('portfolio', JSON.stringify(stocks));
        };

        /**
         * [stocks description]
         * @type {[type]}
         */
        portfolio.stocks = portfolio.dbRead();
        $scope.$watch('portfolio', function() {
            $.each(portfolio.stocks, function(index, stock) {
                stock.invested = '';
                stock.worth = '';
                stock.roi = '';
                stock.roiP = '';
                if (!isNaN(stock.qty) && !isNaN(stock.price)) {
                    stock.invested = (stock.qty * stock.price).toFixed(2);
                    stock.worth = (stock.qty * stock.value).toFixed(2);
                    stock.roi = (stock.worth - stock.invested).toFixed(2);
                    stock.roiP = (((stock.worth) - (stock.invested)) / (stock.worth) * 100).toFixed(2);
                }
            });

            $scope.portfolio.dbWrite(portfolio.stocks);
        }, true);

        function setUpdateInterval(time) {
            $('.progress').remove();
            $('.progressbar').append('<div style="animation-duration: ' + time + 's" class="progress"></div>');
            $('.outdated-message').addClass('hide');
            var updateInterval = $interval(function() {
                var hour = new Date().getHours();
                if (hour >= portfolio.settings.marketOpen && hour < portfolio.settings.marketClose) {
                    $('.progress').remove();
                    $('.progressbar').append('<div style="animation-duration: ' + time + 's" class="progress"></div>');
                    portfolio.updateStocks();
                    setAppStatus('open');
                } else {
                    setAppStatus('closed');
                }
            }, time * 1000);
            return updateInterval;
        }

        function setAppStatus(status) {
            switch (status) {
                case 'open':
                    $('.logo').attr('src', 'assets/icon.png');
                    $('link[rel*="icon"]').attr('href', 'assets/favicon.ico');
                    $('.marketOpen').removeClass('hide');
                    $('.marketClosed').addClass('hide');
                    $('.marketInfo').addClass('hide');
                    break;
                default:
                    $('.progress').remove();
                    $('.logo').attr('src', 'assets/icon_closed.png');
                    $('link[rel*="icon"]').attr('href', 'assets/favicon_closed.ico');
                    $('.marketOpen').addClass('hide');
                    $('.marketClosed').removeClass('hide');
                    $('.marketInfo').addClass('hide');
                    break;
            }
        }

        $scope.portfolio.updateStocks();
        updateInterval = setUpdateInterval(portfolio.settings.update);
        var hour = new Date().getHours();
        if (hour >= portfolio.settings.marketOpen && hour < portfolio.settings.marketClose) {
            setAppStatus('open');
        } else {
            setAppStatus('closed');
        }
    });


    app.directive('contenteditable', function() {
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function(scope, element, attrs, ngModel) {
                function read() {
                    ngModel.$setViewValue(element.html());
                }

                ngModel.$render = function() {
                    element.html(ngModel.$viewValue || '');
                };

                element.bind('blur keyup change', function(e) {
                    scope.$apply(read);
                });
            }
        };
    });

    /**
     * Reverse filter (useful for ng-repeat)
     * @return {[type]} [description]
     */
    app.filter('reverse', function() {
        return function(items) {
            if ($.isEmptyObject(items)) {
                return null;
            }
            return items.slice().reverse();
        };
    });

    var ctx = document.getElementById('historicChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        options: null,
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Minimo',
                    backgroundColor: 'rgba(255, 200, 210, 0.3)',
                    borderColor: 'rgb(255, 99, 132)',
                    pointStyle: 'dash',
                    data: [ 0 ],
                    borderWidth: 1.5,
                    lineTension: 0
                },
                {
                    label: 'Massimo',
                    backgroundColor: 'rgba(230, 255, 200, 0.2)',
                    borderColor: 'rgb(90, 190, 10)',
                    pointStyle: 'dash',
                    data: [ 0 ],
                    borderWidth: 1.5,
                    lineTension: 0
                },
                {
                    label: 'Chiusura',
                    backgroundColor: 'rgba(255, 255, 255, 0)',
                    borderColor: 'rgba(0, 0, 0, 0.5)',
                    pointStyle: 'dash',
                    data: [ 0 ],
                    borderWidth: 1,
                    lineTension: 0
                },
            ]
        }
    });

    function resetChart() {
        chart.data.labels = [];
        $.each(chart.data.datasets, function(index, value) {
            chart.data.datasets[index].data = [];
        });
        chart.update();
    }
    function updateLabels(label) {
        chart.data.labels.push(label);
        chart.update();
    }
    function updateChart(index, value) {
        chart.data.datasets[index].data.push(value);
        chart.update();
    }
})();
