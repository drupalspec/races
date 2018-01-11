
// handles whatever moves along the path
function AnimateWalker(object, settings) {
    this.$walker = object.$el;
    this.reverse = false;
    this.easing = null;

    this.container = this.$walker.parent();

    if ($.isPlainObject(settings)) {
        $.extend(this, settings);
    }
    this.pathAnimator = new PathAnimator(this.path);
}

AnimateWalker.prototype = {
    _getTransformStyle: function (x, y) {

        var left = this.container.width() / this.raceInfo.raceWidth * x;
        var top = this.container.height() / this.raceInfo.raceHeight * y;

        return {
            'transform': 'translate(' + left + 'px,' + top + 'px)',
            '-webkit-transform': 'translate(' + left + 'px,' + top + 'px)',
            '-o-transform': 'translate(' + left + 'px,' + top + 'px)',
            '-moz-transform': 'translate(' + left + 'px,' + top + 'px)'
        }
    },
    _getPositionStyle: function (x, y) {
        var left = (100 * x / this.raceInfo.raceWidth).toFixed(3);
        var top = (100 * y / this.raceInfo.raceHeight).toFixed(3);
        return {
            left: left + '%',
            top: top + '%'
        }
    },
    ready: function () {
        this.$walker.show();
        this.step(this.pathAnimator.pointAt(this.startOffset));
    },
    start: function () {
        //this.startOffset = (this.reverse || this.speed < 0) ? 100 : 0; // if in reversed mode, then animation should start from the end, I.E 100%
        this.pathAnimator.context = this; // just a hack to pass the context of every Walker inside it's pathAnimator
        this.pathAnimator.start(this.speed, this.step, this.reverse, this.startOffset, this.finishCallback, this.easing);
    },

    // Execute every "frame"
    step: function (point) {
        this.$walker.css(this._getTransformStyle(point.x, point.y));
        // this.$walker.css(this._getPositionStyle(point.x, point.y));
    },

    // Restart animation once it was finished
    finishCallback: function () {
        if(this.raceInfo.raceLapBlocker) {
            return;
        }
        this.startOffset = 0;
        this.start();
    },

    // Resume animation from the last completed percentage (also updates the animation with new settings' values)
    resume: function () {
        this.pathAnimator.start(this.speed, this.step, this.reverse, this.pathAnimator.percent, this.finish, this.easing);
    }
};

function initRace(classSelector, options) {
    if (typeof options !== 'object' || options === null) {
        options = {};
    }

    var DELAY_TIME = options.raceStartDelay * 1000 || 2000;
    var RACE_LAP_TIME = options.raceLapTime || 5; //sec
    var RACE_LAPS = options.raceLap || 1; //sec
    var SCORE_OF_FULL_LAP = 100;

    function map(func) {
        return function (values) {
            return Array.prototype.map.call(values, func);
        }
    }

    function sequence() {
        var fns = arguments;

        return function (result) {
            const length = fns.length;
            for (var i = 0; i < length; i++) {
                result = fns[i].call(this, result);
            }

            return result;
        };
    };

    function _sortArrayZA(a, b) {
        var diff = b.score - a.score;
        return diff;
    }

    function getElements(classSelector) {
        return document.getElementsByClassName(classSelector);
    }

    function _createObjectFromEl(el) {
        const $el = $(el);
        return {
            $el: $el,
            score: $el.data('score')
        }
    }

    const getObjectsToComparsion = map(_createObjectFromEl);

    // need to increase all values in array, if biggest value less that length of array
    // [3,2,1,1,1] must be [5,4,3,2,1]
    // in that case we must transform array to [5,4,3,3,3] before sort

    function normalizeObjectScore(array) {
        array.sort(_sortArrayZA);
        var maxValue = array[array.length - 1].score;

        if (maxValue > array.length) {
            return array;
        }

        var diff = array.length - maxValue;
        return map(function (x) { x.score = x.score + diff; return x; })(array);
    }

    function configureWinnersSettings(carsArray) {
        switch (options.raceFinish) {
            case 'before':
                return _setWinnersBeforeFinishLine(carsArray);
                break;
            case 'after':
                return _setWinnersAfterFinishLine(carsArray);
                break;
            default:
                return carsArray;
        }
    }

    function _setWinnersAfterFinishLine(carsArray) {
        var valuesLessThan100 = carsArray.filter(function (x) { return x.score < 100; });

        var valuesGreaterThan100 = carsArray.filter(function (x) { return x.score >= 100; });
        var topLength = valuesGreaterThan100.length;

        valuesGreaterThan100 = valuesGreaterThan100.map(function (x, i) {
            if (x.score >= 100) {
                x.score = 100 + (topLength - i)/3 + 1;
            }
            return x;
        });

        var result = valuesLessThan100.concat(valuesGreaterThan100);
        result.sort(_sortArrayZA);

        return result;
    }

    function _setWinnersBeforeFinishLine(carsArray) {
        var winnerInTop = carsArray.filter(function (x) { return x.score > 100; });

        if (!winnerInTop.length) {
            return carsArray;
        }

        var maxScore = winnerInTop[0].score;
        return carsArray.map(function (x) {
            x.score = parseInt(100 * x.score / maxScore, 10);
            return x;
        });
    }

    function spreadCars(array) {
        var valuesLessThan100 = array.filter(function (x) { return x.score < 100; });
        var sortedValuesLessThan100 = _spreadArrayDown(valuesLessThan100);

        var valuesGreaterThan100 = array.filter(function (x) { return x.score >= 100; });
        var sortedValuesGreaterThan100 = _spreadArrayUp(valuesGreaterThan100);
        var result = sortedValuesLessThan100.concat(sortedValuesGreaterThan100);
        result.sort(_sortArrayZA);
        return result;
    }

    function _spreadArrayDown(array) {
        array.sort(_sortArrayZA);
        return array.reduce(_functionSpreadDownForArray(array), new Array(array.length));
    }

    function _functionSpreadDownForArray(array) {
        return function (result, value, index) {
            if (index > 0) {
                if (array[index - 1].score <= value.score) {
                    value.score = value.score - 1;
                }
                if (result[index - 1].score <= value.score) {
                    value.score = result[index - 1].score - 1;
                }
            }
            result[index] = value;
            return result;
        }
    }

    function _spreadArrayUp(array) {
        array.sort(_sortArrayZA).reverse();
        return array.reduce(_functionSpreadUpForArray(array), new Array(array.length));
    }

    function _functionSpreadUpForArray(array) {
        return function (result, value, index) {
            if (index > 0) {
                if (array[index - 1].score == value.score) {
                    value.score = value.score + 1;
                }
                if (result[index - 1].score == value.score) {
                    value.score = result[index - 1].score + 1;
                }
            }
            result[index] = value;
            return result;
        }
    }

    function setStartOffsets(carsArray) {
        var carsTotal = carsArray.length;
        return carsArray.map(function (x, i) {
            var startOffsetInPercents = (carsTotal - i) * 0.4;
            x.startOffset = startOffsetInPercents;
            return x;
        });
    }

    function setSpeed(carsArray) {
        var raceLapCoefficient = {
            1: 0.972,
            2: 0.986,
            3: 0.988,
            4: 0.99
        };

        return carsArray.map(function (x, i) {
            var scoreCoefficient = raceLapCoefficient[RACE_LAPS];
            x.speed = RACE_LAP_TIME * SCORE_OF_FULL_LAP * scoreCoefficient / x.score;
            return x;
        });
    }

    function generateWalkers(carsArray) {
        var carsTotal = carsArray.length;
        var walkers = new Array(carsTotal);

        var fullLapScore = 100;

        carsArray.forEach(function (car, i) {
            car.$el.css('zIndex', 100 - i);

            car.$el.attr('of', car.startOffset);
            car.$el.attr('as', car.score);
            car.$el.attr('in', car.$el.index());
            car.$el.attr('sc', car.$el.data('score'));

            walkers[i] = new AnimateWalker(car, {
                path: _getRacePath(i),
                speed: car.speed,
                startOffset: car.startOffset,
                raceInfo: options
            });
        });

        return walkers;
    }

    function _getRacePath(index) {
        return index % 2 ? options.racePath2 : options.racePath1;
    }

    function initRace(walkers) {
        walkers.forEach(function (walker) {
            walker.ready();
        })
        startRace(walkers);
        stopRace(walkers);
    }

    function startRace(walkers) {
        setTimeout(function () {
            walkers.forEach(function (walker) {
                walker.start();
            });
        }, DELAY_TIME);
    }

    function stopRace(walkers) {
        setTimeout(function () {
            walkers.forEach(function (walker) {
                walker.pathAnimator.stop();
            });
        }, DELAY_TIME + RACE_LAP_TIME * RACE_LAPS * 1000);
    }

    var prepareRace = sequence(getElements, getObjectsToComparsion, normalizeObjectScore, configureWinnersSettings, spreadCars, setStartOffsets, setSpeed, generateWalkers, initRace);

    prepareRace(classSelector);

}