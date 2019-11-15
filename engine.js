var log = console.log.bind(console)
var Game = new function(){
	this.init = function(canvasElementId,sprite_data,callback){
		this.canvas = document.getElementById(canvasElementId)
		this.ctx = this.canvas.getContext('2d')
		this.width =this.canvas.width
		this.height = this.canvas.height
		// log(this.canvas.width)
		this.setupInput()
		this.loop()
		SpriteSheet.load(sprite_data,callback)
	}	
	var KEY_CODES = {65:'left',68:'right',32:'fire'}	
	this.keys = {}
	this.setupInput = function(){
		window.addEventListener('keydown',function(event){
			if(KEY_CODES[event.keyCode]){
				// log(KEY_CODES[event.keyCode])
				Game.keys[KEY_CODES[event.keyCode]]=true
				event.preventDefault()
			}
		},false)
		window.addEventListener('keyup',function(event){
			if(KEY_CODES[event.keyCode]){
				Game.keys[KEY_CODES[event.keyCode]]=false
				event.preventDefault()
			}
		},false)
	}
	// Game loop
	var boards = []
	this.loop = function(){
			setInterval(function(){
				var dt=30/1000
				for(var i=0,len=boards.length;i<len;i++){
					if(boards[i]){
						boards[i].step(dt)
						boards[i]&&boards[i].draw(Game.ctx)
					}
				}
			},30)		
		// setTimeout(Game.loop,30)
	}
	// change an active game board
	this.setBoard = function(num,board){
		boards[num]=board
	}
}

var Sprite = function(){ }
Sprite.prototype.setup = function(sprite,props){
	this.sprite = sprite
	this.merge(props)
	this.frame = this.frame || 0
	this.w = SpriteSheet.map[sprite].w
	this.h = SpriteSheet.map[sprite].h
}
Sprite.prototype.merge = function(props){
	if(props){
		for(var prop in props){
			this[prop] = props[prop]
		}
	}
}
Sprite.prototype.draw = function(ctx){
	SpriteSheet.draw(ctx,this.sprite,this.x,this.y,this.frame)
}
Sprite.prototype.hit = function(damage){
	this.board.remove(this)
}

var SpriteSheet = new function() {
	this.map = {}
	this.load = function(spriteData,callback){
		this.map=spriteData
		this.image = new Image()		
		this.image.onload = callback
		this.image.src = "images/sprites.png"
	}
	this.draw = function(ctx,sprite,x,y,frame){
		var s = this.map[sprite]
		// this.frame = frame
		// log(s)
		if(!frame) this.frame = 0
		Game.ctx.drawImage(this.image,s.sx+this.frame*s.w,s.sy,s.w,s.h,x,y,s.w,s.h)
		// log(s.w)
	}
}

var GameBoard = function() {
  var board = this;

  // The current list of objects
  this.objects = [];

  // Add a new object to the object list
  this.add = function(obj) { 
    obj.board=this; 
    this.objects.push(obj); 
    return obj; 
  };

  // Mark an object for removal
  this.remove = function(obj) { 
    this.removed.push(obj); 
    return true
  };

  // Reset the list of removed objects
  this.resetRemoved = function() { this.removed = []; }

  // Removed an objects marked for removal from the list
  this.finalizeRemoved = function() {
    for(var i=0,len=this.removed.length;i<len;i++) {
      var idx = this.objects.indexOf(this.removed[i]);
      if(idx != -1) this.objects.splice(idx,1);
    }
  } 

  // Call step on all objects and them delete
  // any object that have been marked for removal
  this.step = function(dt) { 
    this.resetRemoved();
    this.iterate('step',dt);
    this.finalizeRemoved();
  };

  // Draw all the objects
  this.draw= function(ctx) {
    this.iterate('draw',ctx);
  };

    // Call the same method on all current objects 
  this.iterate = function(funcName) {
     var args = Array.prototype.slice.call(arguments,1);
     for(var i=0,len=this.objects.length;i<len;i++) {
       var obj = this.objects[i];
       obj[funcName].apply(obj,args)
     }
  };

   // Find the first object for which func is true
  this.detect = function(func) {
    for(var i = 0,val=null, len=this.objects.length; i < len; i++) {
      if(func.call(this.objects[i])) return this.objects[i];
    }
    return false;
  };

  // Check for a collision between the 
  // bounding rects of two objects
  this.overlap = function(o1,o2) {
    return !((o1.y+o1.h-1<o2.y) || (o1.y>o2.y+o2.h-1) ||
             (o1.x+o1.w-1<o2.x) || (o1.x>o2.x+o2.w-1));
  };

  // Find the first object that collides with obj
  // match against an optional type
  this.collide = function(obj,type) {  	
  	this.func = function() {
      if(obj != this) {
       var col = (!type || this.type == type) && board.overlap(obj,this)
       return col ? this : false;
      }
    }

    return this.detect(this.func);
  };
};

var TitleScreen = function TitleScreen(title,subtitle,callback){
	this.step = function(dt){
		if(Game.keys['fire']&&callback) callback()			
	}
	
	this.draw = function(ctx){
		ctx.fillStyle="#fff"
		ctx.textAlign = "center"

		ctx.font = "bold 40 px bangers"
		ctx.fillText(title,Game.width/2,Game.height/2)

		ctx.font = "bold 20px banngers"
		ctx.fillText(subtitle,Game.width/2,Game.height/2+40)
	}
}

var Explosion = function(centerX,centerY){
	this.setup('explosion',{frame:0});
	this.x = centerX - this.w/2
	this.y = centerY - this.h/2
	this.subFrame = 0
}
Explosion.prototype = new Sprite()
Explosion.prototype.step = function(dt){
	this.frame = Math.floor(this.subFrame++/3)
	if(this.subFrame >= 36){
		this.board.remove(this)
	}
}

var Level = function(levelData,callback) {
  this.levelData = [];
  for(var i =0; i<levelData.length; i++) {
    this.levelData.push(Object.create(levelData[i]));
  }
  this.t = 0;
  this.callback = callback;
};

Level.prototype.step = function(dt) {
  var idx = 0, remove = [], curShip = null;

  // Update the current time offset
  this.t += dt * 1000;

  //   Start, End,  Gap, Type,   Override
  // [ 0,     4000, 500, 'step', { x: 100 } ]
  while((curShip = this.levelData[idx]) && 
        (curShip[0] < this.t + 2000)) {
    // Check if we've passed the end time 
    if(this.t > curShip[1]) {
      remove.push(curShip);
    } else if(curShip[0] < this.t) {
      // Get the enemy definition blueprint
      var enemy = enemies[curShip[3]],
          override = curShip[4];

      // Add a new enemy with the blueprint and override
      this.board.add(new Enemy(enemy,override));

      // Increment the start time by the gap
      curShip[0] += curShip[2];
    }
    idx++;
  }

  // Remove any objects from the levelData that have passed
  for(var i=0,len=remove.length;i<len;i++) {
    var remIdx = this.levelData.indexOf(remove[i]);
    if(remIdx != -1) this.levelData.splice(remIdx,1);
  }

  // If there are no more enemies on the board or in 
  // levelData, this level is done
  // if(this.levelData.length === 0 && this.board.cnt[OBJECT_ENEMY] === 0) {
  //   if(this.callback) this.callback();
  // }

};

Level.prototype.draw = function(ctx) { };