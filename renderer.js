const SAT = require('./lib/SAT');

const CS = 128;
const PADDING = 100;
const AR = 350 ;

console.log(SAT);

class Renderer {

    constructor() {
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');

        this.canvas.width = 1280;
        this.canvas.height = 720;

        this.clear();

        this.objects = new Set();

        window.addEventListener('resize', event => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
    }

    clear() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        //this.context.fillStyle = "rgba(0,0,0,0.2)";
        //this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    render() {
        this.objects.forEach(object => this.renderObject(object));
    }

    renderObject(object) {
        object.render(this.context);
    }

}

class RenderObject {

    constructor() {
        this.x = 0;
        this.y = 0;
    }

    render(context) {

    }

}

class ResourceImage extends RenderObject {

    constructor(src) {
        super();

        this.image = new Image();
        this.image.src = src;

        this.width = null;
        this.height = null;
    }

    render(context) {
        context.drawImage(this.image, this.x, this.y, this.width, this.height);
    }

}

class Circle extends RenderObject {

    constructor() {
        super();
    }

    render(context) {
        context.beginPath();
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.arc(this.x, this.y, CS / 2, 0, 2 * Math.PI, false);
        context.fill();
        context.stroke();
    }

}

var renderer = new Renderer();

var circle = new ResourceImage('./resources/hitcircle.png');
circle = new Circle();

var slider = new Circle();

document.body.appendChild(renderer.canvas);

var audio = new Audio();
audio.src = './songs/292301 xi - Blue Zenith/zenith.mp3';
//audio.src = './songs/332532 Panda Eyes & Teminite - Highscore/Teminite & Panda Eyes - Highscore.mp3';
//audio.src = './songs/203309 Ni-Sokkususu - Shukusai no Elementalia/zettairyouiki.mp3';
//audio.src = './songs/371128 Station Earth - Cold Green Eyes ft Roos Denayer/Cold Green Eyes.mp3';
audio.autoplay = true;
console.log(audio.playbackRate);
audio.playbackRate = 1;

// debug
this.audio = audio;
window.ctx = this;

function convertX(w, x) {
    return ((w - 512) / 2) + x;
}

function convertY(h, y) {
    return ((h - 384) / 2) + y;
}

function convertXY(w, h, x, y) {
    if(w >= h) {
        var sw = (512/ 384) * (h - (PADDING * 2));
        var sh = h - (PADDING * 2);

        return {
            x: (x * (sw / 512)),
            y: y * (sh / 384)
        };
    }
    else {
        throw 'fuckoff';
    }
}

audio.onplaying = () => {

    var parser = require('osu-parser');

    parser.parseFile('./songs/292301 xi - Blue Zenith/xi - Blue Zenith (Asphyxia) [FOUR DIMENSIONS].osu', function (err, beatmap) {
    //parser.parseFile('./songs/332532 Panda Eyes & Teminite - Highscore/Panda Eyes & Teminite - Highscore (Fort) [Game Over].osu', function (err, beatmap) {
    //parser.parseFile('./songs/203309 Ni-Sokkususu - Shukusai no Elementalia/Ni-Sokkususu - Shukusai no Elementalia (Silynn) [Kneesocks].osu', function (err, beatmap) {
    //parser.parseFile('./songs/371128 Station Earth - Cold Green Eyes ft Roos Denayer/Station Earth - Cold Green Eyes ft. Roos Denayer (Bearizm) [Divine].osu', function (err, beatmap) {

        console.log(beatmap.hitObjects.filter(x => x.objectName !== 'circle'));

        function render() {
            var deltaTime = Math.floor(audio.currentTime * 1000);

            renderer.clear();

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
    });

};