const Constants = require('./lib/Constants');
const SAT = require('./lib/SAT');
const path = require('path');
const fs = require('fs');
const osuParser = require('osu-parser');
const util = require('util');
const Victor = require('victor');

const CS = 128;
const PADDING = 100;
const AR = 350 ;

class Renderer {

    constructor() {
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');

        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.clear();

        this.objects = new Set();

        window.addEventListener('resize', event => {
            this.canvas.width = Math.max(window.innerWidth, Constants.OSU_VIEW_WIDTH);
            this.canvas.height = Math.max(window.innerHeight, Constants.OSU_VIEW_HEIGHT);
        });
    }

    clear() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    render() {
        this.objects.forEach(object => this.renderObject(object));
    }

    renderObject(object) {
        object.render(this.context);
    }

    get width() {
        return this.canvas.width;
    }

    get height() {
        return this.canvas.height;
    }

    get pixelScaleFactor() {
        if((this.height / this.width) <= (Constants.OSU_VIEW_HEIGHT / Constants.OSU_VIEW_WIDTH)) {
            return this.height / Constants.OSU_VIEW_HEIGHT;
        }
        else {
            return this.width / Constants.OSU_VIEW_WIDTH;
        }
    }

    convertOsuPosition(vector) {
        var h, w;

        if((this.height / this.width) <= (Constants.OSU_VIEW_HEIGHT / Constants.OSU_VIEW_WIDTH)) {
            h = this.height;
            w = (Constants.OSU_VIEW_WIDTH / Constants.OSU_VIEW_HEIGHT) * this.height;
        }
        else {
            w = this.width;
            h = (Constants.OSU_VIEW_HEIGHT / Constants.OSU_VIEW_WIDTH) * this.width;
        }

        var x = (vector.x * (w / Constants.OSU_VIEW_WIDTH)) + ((this.width - w) / 2);
        var y = (vector.y * (h / Constants.OSU_VIEW_HEIGHT)) + ((this.height - h) / 2);

        return new Victor(x, y);
    }

}

class RenderObject {

    constructor() {
        // ...
    }

    render(renderer) {
        throw 'Render method must be implemented';
    }

}

class Circle extends RenderObject {

    constructor(hitObject) {
        super();

        this.hitObject = hitObject;
    }

    render(context) {
        if(!this.position) {

        }

        context.beginPath();
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.arc(this.x, this.y, CS / 2, 0, 2 * Math.PI, false);
        context.fill();
        context.stroke();
    }

}

class HitObjectManager extends Set {

    constructor() {
        super();
    }

    update(deltaTime) {
        this.forEach(object => {
            if(object.objectName === 'circle') {
                if(deltaTime >= (object.startTime - AR) && deltaTime <= object.startTime) {
                    if(!object.visible) {
                        // Init stuff
                        object.visible = true;
                    }

                    object.msLeftToStart = object.startTime - deltaTime;
                }
                else {
                    object.visible = false;
                }
            }
            else if(object.objectName === 'slider') {
                if(deltaTime >= (object.startTime - AR) && deltaTime <= object.endTime) {
                    if(!object.visible) {
                        // Init stuff
                        object.visible = true;
                    }

                    object.msLeftToStart = object.startTime - deltaTime;
                    object.slidePc = (object.duration - (object.endTime - deltaTime)) / object.duration;

                    if(object.duration > 1000) {
                        console.log(object.slidePc);
                    }
                }
                else {
                    object.visible = false;
                }
            }
        });
    }

    render(renderer) {
        this.forEach(object => {
            if(object.objectName === 'circle') {
                if(object.visible) {
                    if(!object.renderObject) {
                        object.renderObject = new HitCircle(new Victor(object.position[0], object.position[1]));
                    }

                    object.renderObject.render(renderer, object.msLeftToStart / AR);
                }
            }
            else if(object.objectName === 'slider') {
                if(object.visible) {
                    if (!object.renderObject) {
                        var points = object.points.map(p => new Victor(p[0], p[1]));

                        object.renderObject = new Slider(new Victor(object.position[0], object.position[1]), object.curveType,
                            points, new Victor(object.endPosition[0], object.endPosition[1]), object.pixelLength);
                    }

                    object.renderObject.render(renderer, object.msLeftToStart / AR, object.slidePc);
                }
            }
        });
    }

}

class HitObject extends RenderObject {

    constructor(position) {
        super();
        this.position = position;
    }

}

class HitCircle extends HitObject {

    render(renderer, approachPc) {
        var context = renderer.context;
        var pos = renderer.convertOsuPosition(new Victor(this.position.x, this.position.y));

        // Circle
        context.beginPath();
        context.strokeStyle = 'white';
        context.fillStyle = this.colour || 'rgba(255, 0, 0, 0.5)';
        context.lineWidth = 2;
        context.arc(pos.x, pos.y, CS / 2, 0, 2 * Math.PI, false);
        context.fill();
        context.stroke();

        // Dot in the middle
        context.beginPath();
        context.fillStyle = 'black';
        context.arc(pos.x, pos.y, 2, 0, 2 * Math.PI, false);
        context.fill();

        // Approach circle
        if(approachPc !== null && approachPc >= 0) {
            context.beginPath();
            context.strokeStyle = 'red';
            context.lineWidth = 4;
            context.arc(pos.x, pos.y, (CS * approachPc) + (CS / 2), 0, 2 * Math.PI, false);
            context.stroke();
        }
    }

}

class Slider extends HitObject {

    constructor(position, curveType, points, endPosition, pixelLength) {
        super(position);

        this.curveType = curveType;
        this.points = points;
        this.endPosition = endPosition;
        this.pixelLength = pixelLength;

        this.startCircle = new HitCircle(position);
        this.startCircle.colour = 'rgba(0, 0, 255, 0.5)';

        this.endCircle = new HitCircle(endPosition);
        this.endCircle.colour = 'rgba(0, 0, 255, 0.5)';

        this.ball = new HitCircle(position);
        this.ball.colour = 'rgba(255, 0, 255, 0.5)';
    }

    render(renderer, approachPc, slidePc) {
        var context = renderer.context;

        if(this.curveType === 'linear' || this.curveType === 'pass-through' ||
            (this.curveType === 'beizer' && this.points.length === 2) || true) {
            context.beginPath();

            let pos = renderer.convertOsuPosition(this.points[0]);
            context.moveTo(pos.x, pos.y);

            for(let i = 1; i < this.points.length; i++) {
                pos = renderer.convertOsuPosition(this.points[i]);
                context.lineTo(pos.x, pos.y)
            }

            var lastPoint = this.points[this.points.length - 1];
            if(lastPoint.x !== this.position.x || lastPoint.y !== this.position.y) {
                pos = renderer.convertOsuPosition(this.points[this.points.length - 1]);
                context.lineTo(pos.x, pos.y)
            }

            context.strokeStyle = 'rgba(0, 0, 255, 0.5)';

            if(this.curveType === 'beizer') {
                context.strokeStyle = 'rgba(0, 255, 255, 0.5)';
            }

            context.lineWidth = CS;
            context.stroke();
        }
        else if(this.curveType === 'bezier') {

        }

        if(slidePc <= 1.0) {
            var pixelDistance = slidePc * (this.pixelLength * renderer.pixelScaleFactor);

            var currentDistance = 0;

            for(var i in this.points) {
                var point = this.points[i];

                if((i - 1) in this.points) {
                    currentDistance += Math.abs(this.points[i - 1].distance(point));
                }
                else {
                    currentDistance += Math.abs(this.position.distance(point));
                }

                if(currentDistance >= pixelDistance) {
                    let distX, distY;

                    if((i + 1) in this.points) {
                        distX = point.distanceX(this.points[i + 1]);
                        distY = point.distanceY(this.points[i + 1]);
                    }
                    else {
                        distX = point.distanceX(this.endPosition);
                        distY = point.distanceY(this.endPosition);
                    }

                    this.ball.position = point.clone();
                    //this.ball.position.x -= distX * (slidePc - (currentDistance / this.pixelLength));
                    //this.ball.position.y -= distY * (slidePc - (currentDistance / this.pixelLength));

                    this.ball.render(renderer, null);
                    break;
                }
            }
        }

        this.startCircle.render(renderer, approachPc);
        this.endCircle.render(renderer, null);
    }
}

class Grid extends RenderObject {

    render(renderer) {
        var context = renderer.context;

        for(var x = 0; x <= Constants.OSU_VIEW_WIDTH; x += 4) {
            let start = renderer.convertOsuPosition(new Victor(x, 0));
            let end = renderer.convertOsuPosition(new Victor(x, Constants.OSU_VIEW_HEIGHT));

            context.beginPath();
            context.moveTo(start.x, start.y);
            context.lineTo(end.x, end.y);
            context.lineWidth = 1;
            context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            context.stroke();
        }

        for(var y = 0; y <= Constants.OSU_VIEW_HEIGHT; y += 4) {
            let start = renderer.convertOsuPosition(new Victor(0, y));
            let end = renderer.convertOsuPosition(new Victor(Constants.OSU_VIEW_WIDTH, y));

            context.beginPath();
            context.moveTo(start.x, start.y);
            context.lineTo(end.x, end.y);
            context.lineWidth = 1;
            context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            context.stroke();
        }
    }

}

var renderer = new Renderer();

window.renderer = renderer;

var circle = new Circle();

var grid = new Grid();
var gridToggle = document.getElementById('grid-toggle');

var progress = document.getElementById('progress');

document.body.appendChild(renderer.canvas);

function playMapAudio(beatmap, audio) {
    var manager = new HitObjectManager();

    // Write map to file
    fs.writeFile('./map', util.inspect(beatmap, { showHidden: true, depth: null, maxArrayLength: null }));
    fs.writeFile('./map.json', JSON.stringify(beatmap));

    manager.clear();
    beatmap.hitObjects.forEach(o => manager.add(o));

    function render() {
        var deltaTime = Math.floor(audio.currentTime * 1000);

        if(audio.paused !== true) {
            progress.value = deltaTime;
        }

        renderer.clear();

        if(gridToggle.checked) {
            grid.render(renderer);
        }

        manager.update(deltaTime);
        manager.render(renderer);

        requestAnimationFrame(render);
    }

    render();
}

var audio = null;

function loadMapFile(file) {
    var songDirectrory = path.dirname(file);

    osuParser.parseFile(file, function (err, beatmap) {
        if(beatmap.bgFilename) {
            var bgFile = path.join(songDirectrory, beatmap.bgFilename);
            document.body.style.backgroundImage = 'url("' + bgFile.replace(/\\/g, '/') + '")';

            console.log(bgFile.replace(/\\/g, '/'));
        }
        else {
            document.body.style.backgroundImage = 'none';
        }

        var audioFile = path.join(songDirectrory, beatmap.AudioFilename);

        if(audio) {
            audio.pause();
            delete audio;
        }

        audio = new Audio();
        audio.src = audioFile;
        audio.autoplay = true;
        audio.playbackRate = 1;

        audio.addEventListener('loadedmetadata', function(event) {
            progress.max = Math.floor(audio.duration * 1000);
        });

        playMapAudio(beatmap, audio);
    });
}

fs.readdir('./songs', (err, files)  => {
    files.forEach(file => {
        var fullSongPath = path.join('./songs', file);

        if(fs.statSync(fullSongPath).isDirectory()) {
            fs.readdir(fullSongPath, (err, subfiles)  => {
                var mapFiles = subfiles.filter(f => f.match(/\.osu$/i));

                mapFiles.forEach(mapFile => {
                    var fullMapFile = path.join(fullSongPath, mapFile);

                    osuParser.parseFile(fullMapFile, function (err, beatmap) {
                        var displayTitle = util.format('%s - %s [%s]', beatmap.ArtistUnicode, beatmap.TitleUnicode, beatmap.Version);

                        var selectOption = document.createElement('option');
                        selectOption.textContent = displayTitle;
                        selectOption.value = fullMapFile;

                        document.getElementById('select-map').appendChild(selectOption);
                    });
                });
            });
        }
    });
});

document.getElementById('select-map').addEventListener('change', function(event) {
    if(this.selectedOptions.length > 0) {
        var selected = this.selectedOptions[0];
        loadMapFile(selected.value);
    }
});

document.getElementById('playback-rate').addEventListener('change', function(event) {
    audio.playbackRate = this.value;
});

document.getElementById('play-pause').addEventListener('click', function(event) {
    if(audio.paused === true) {
        audio.play();
        this.textContent = 'Pause';
    }
    else {
        audio.pause();
        this.textContent = 'Play';
    }
});

progress.addEventListener('change', function(event) {
    var oldTime = audio.currentTime;
    audio.currentTime = this.value / 1000;
});

return;

var audio = new Audio();
//audio.src = './songs/292301 xi - Blue Zenith/zenith.mp3';
//audio.src = './songs/332532 Panda Eyes & Teminite - Highscore/Teminite & Panda Eyes - Highscore.mp3';
//audio.src = './songs/203309 Ni-Sokkususu - Shukusai no Elementalia/zettairyouiki.mp3';
//audio.src = './songs/371128 Station Earth - Cold Green Eyes ft Roos Denayer/Cold Green Eyes.mp3';
audio.src = './songs/158023 UNDEAD CORPORATION - Everything will freeze/12 - Everything will freeze.mp3';
audio.autoplay = true;
console.log(audio.playbackRate);
audio.playbackRate = 1;

var firstTimeFlag = false;

audio.onplaying = () => {

    if(firstTimeFlag) {
        return;
    }

    firstTimeFlag = true;

    var parser = require('osu-parser');

    //parser.parseFile('./songs/292301 xi - Blue Zenith/xi - Blue Zenith (Asphyxia) [FOUR DIMENSIONS].osu', function (err, beatmap) {
    //parser.parseFile('./songs/332532 Panda Eyes & Teminite - Highscore/Panda Eyes & Teminite - Highscore (Fort) [Game Over].osu', function (err, beatmap) {
    //parser.parseFile('./songs/203309 Ni-Sokkususu - Shukusai no Elementalia/Ni-Sokkususu - Shukusai no Elementalia (Silynn) [Kneesocks].osu', function (err, beatmap) {
    //parser.parseFile('./songs/371128 Station Earth - Cold Green Eyes ft Roos Denayer/Station Earth - Cold Green Eyes ft. Roos Denayer (Bearizm) [Divine].osu', function (err, beatmap) {
    parser.parseFile('./songs/158023 UNDEAD CORPORATION - Everything will freeze/UNDEAD CORPORATION - Everything will freeze (Ekoro) [Time Freeze].osu', function (err, beatmap) {
        var manager = new HitObjectManager();

        // Write map to file
        require('fs').writeFile('./map', require('util').inspect(beatmap, { showHidden: true, depth: null, maxArrayLength: null }));

        beatmap.hitObjects.forEach(o => manager.add(o));

        function render() {
            var deltaTime = Math.floor(audio.currentTime * 1000);

            if(audio.paused === false) {
                document.getElementById('position').value = deltaTime;
            }

            renderer.clear();

            grid.render(renderer);

            manager.update(deltaTime);
            manager.render(renderer);

            /*

            beatmap.hitObjects.forEach(ho => {

                if(ho.objectName === 'circle') {
                    if (deltaTime >= (ho.startTime - AR) && deltaTime <= ho.startTime) {
                        var pos = convertXY(renderer.canvas.width, renderer.canvas.height, ho.position[0], ho.position[1]);

                        circle.x = pos.x;
                        circle.y = pos.y;

                        renderer.context.fillStyle = ho.hit ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
                        renderer.renderObject(circle);

                        if(!ho.active) {
                            ho.active = true;
                            ho.vec = new SAT.Circle(new SAT.Vector(pos.x, pos.y), CS / 2);
                        }
                    }
                    else {
                        ho.active = false;
                    }
                }
                else if(ho.objectName === 'slider') {
                    if (deltaTime >= (ho.startTime - AR) && deltaTime <= ho.startTime) {

                        if(ho.curveType === 'linear') {
                            var ctx = renderer.context;

                            ctx.beginPath();

                            var pos = convertXY(renderer.canvas.width, renderer.canvas.height, ho.points[0][0], ho.points[0][1]);

                            ctx.moveTo(pos.x, pos.y);

                            for (var i = 1; i < ho.points.length; i++) {
                                pos = convertXY(renderer.canvas.width, renderer.canvas.height, ho.points[i][0], ho.points[i][1]);
                                ctx.lineTo(pos.x, pos.y);
                            }

                            ctx.strokeStyle = 'white';
                            ctx.lineWidth = CS;
                            ctx.stroke();
                        }
                        else if(ho.curveType === 'beizer') {
                            var ctx = renderer.context;

                            var lastIndex = 0;

                            for(var i = 0; i < ho.points.length; i++) {
                                // if (hitObjectManager.Beatmap.BeatmapVersion > 8)
                                //var multipartSegment = i < ho.points.length - 2 && sliderCurvePoints[i] == sliderCurvePoints[i + 1];
                            }
                        }
                        else {
                            console.log(ho);
                        }

                    }
                }
            });
             */

            //renderer.render();

            requestAnimationFrame(render);
        }

        render();

        audio.play();

        function trackHits(x, y) {
            beatmap.hitObjects.forEach(ho => {
                if(ho.active) {
                    if(SAT.pointInCircle(new SAT.Vector(x, y), ho.vec)) {
                        ho.hit = true;
                        return false;
                    }
                }
            });
        }

        renderer.canvas.addEventListener('mousedown', function(event) {
            trackHits(event.clientX, event.clientY);
        });

        var tracked = { x: 0, y: 0 };

        renderer.canvas.addEventListener('mousemove', function(event) {
            tracked.x = event.clientX;
            tracked.y = event.clientY;

            //trackHits(tracked.x, tracked.y);
        });

        document.addEventListener('keydown', function(event) {
            if(event.keyCode === 88 || event.keyCode === 90) {
                trackHits(tracked.x, tracked.y);
            }
        });

        document.getElementById('playback-rate').addEventListener('change', function(event) {
            audio.playbackRate = this.value;
        });

        document.getElementById('play-pause').addEventListener('click', function(event) {
            if(audio.paused === true) {
                audio.play();
                this.textContent = 'Pause';
            }
            else {
                audio.pause();
                this.textContent = 'Play';
            }
        });

        document.getElementById('position').addEventListener('change', function(event) {
            var oldTime = audio.currentTime;
            audio.currentTime = this.value / 1000;
            console.log(this.value, audio.currentTime, oldTime);
        });
    });

};