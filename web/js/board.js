function getCursorPosition(e, target) {
    var x, y;
    if (e.offsetX != undefined && e.offsetY != undefined) {
        // Chrome
        x = e.offsetX;
        y = e.offsetY;
    } else if (e.pageX != undefined && e.pageY != undefined) {
        // Firefox
        x = e.pageX - $(target).position().left;
        x -= parseInt($(target).css('margin-left'));
        y = e.pageY - $(target).position().top;
        y -= parseInt($(target).css('margin-top'));
    } else {
        // ...idk?
        x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
        y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }

    return {'x': x, 'y': y};
}

/* Main */
$(function() {
    var b = new Board();

    var a = new ArrowTool(b);
    var n = new NodeTool(b);
    var n = new LineTool(b);

    b.set_tool(a);
});

function Board() {
    this.type = "board";
    this.drawers = [];

    this.drag = 0;
    this.drag_target = null;

    this.canvas = document.getElementById('board');
    this.ctx = this.canvas.getContext('2d');

    this.snap = false;
    this.snap_size = 20;
    var board = this;

    board.redraw = function() {
        board.ctx.clearRect(0, 0, board.canvas.width, board.canvas.height);
        for (var i=0; i<board.drawers.length; i++) {
            board.drawers[i].draw(board.ctx);
        };
    }
    // Redraw 20 times a second.
    setInterval(this.redraw, 50);

    this.set_tool = function(tool) {
        if (this.cur_tool) {
            $(this.cur_tool.elem).removeClass('active');
        }
        this.cur_tool = tool;
        $(this.cur_tool.elem).addClass('active');
    }

    $('#board').bind('mousedown', function(e) {
        if (!board.cur_tool) {
            return;
        }
        var p = getCursorPosition(e, $('#board'));
        e.real_x = p.x; e.real_y = p.y;

        for (var i=0; i<board.drawers.length; i++) {
            if (board.drawers[i].hit_test(e.real_x, e.real_y)) {
                board.drag_target = board.drawers[i];
                board.drag = 1;
            }
        }
        console.log(e.real_x + ' ' + e.real_y);
        board.cur_tool.mousedown(e, board.drag_target);
    });

    $('#board').bind('mousemove', function(e) {
        if (!board.cur_tool) {
            return;
        }
        var p = getCursorPosition(e, $('#board'));
        e.real_x = p.x; e.real_y = p.y;

        for (var i=0; i<board.drawers.length; i++) {
            var d = board.drawers[i];
            d.hover = d.hit_test(e.real_x, e.real_y);
        }

        if (board.drag == 0) {
            board.cur_tool.mousemove(e);
        }
        if (board.drag == 1) {
            board.drag = 2;
            board.cur_tool.dragstart(e, board.drag_target);
        }
        if (board.drag == 2) {
            board.cur_tool.drag(e, board.drag_target);
        }
    });

    $('#board').bind('mouseup', function(e) {
        if (!board.cur_tool) {
            return;
        }
        var p = getCursorPosition(e, $('#board'));
        e.real_x = p.x; e.real_y = p.y;

        if (board.drag >= 2) {
            board.cur_tool.dragend(e, board.drag_target);
        } else {
            board.cur_tool.click(e, board.drag_target);
        }
        board.cur_tool.mouseup(e, board.drag_target);

        board.drag = 0;
        board.drag_target = null;
    });

    $('<input type="checkbox"/>Snap</input>').appendTo('#tools')
        .bind('change', function(e) {
            board.snap = $(this).prop('checked');
        });

    this.snap_to = function(x, y) {
        if (!this.snap) {
            return {'x': x, 'y': y};
        }
        var mx = x % this.snap_size;
        var my = y % this.snap_size;

        if (mx < this.snap_size / 2) {
            x -= mx;
        } else {
            x += this.snap_size - mx;
        }
        if (my < this.snap_size / 2) {
            y -= my;
        } else {
            y += this.snap_size - my;
        }

        return {'x': x, 'y': y};
    }
}

function Node(board, x, y) {
    this.type = "node";
    this.board = board;
    this.notes = [];
    this.x = x;
    this.y = y;
    this.r = 5;
    this.selected = false;
    this.hover = false;

    board.drawers.push(this);

    this.draw = function() {
        var ctx = board.ctx;
        ctx.save();

        ctx.strokeStyle = 'rgb(0,0,0)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI*2, true);

        if (this.hover) {
            ctx.fillStyle = 'rgb(196, 196, 196)';
        } else {
            ctx.fillStyle = 'rgb(128, 128, 128)';
        }

        ctx.fill();
        ctx.stroke();

        if (this.selected) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r + 3, 0, Math.PI*2, true);
            ctx.stroke();
        }

        ctx.fillStyle = "rgba(0,0,0,0.7)"
        var text_x = this.x + 10;
        var text_y = this.y + 10;
        for (var i=0; i<this.notes.length; i++) {
            ctx.fillText(key + ': ' + this.notes[i], text_x, text_y);
            text_y += 12;
        }

        ctx.restore();
    }

    /* Check if a given point is within the bounds of this node. */
    this.hit_test = function(x, y) {
        // Make clicking a bit easier.
        var fuzzy_r = this.r + 5;

        // Fast bounding box check
        if ((Math.abs(x - this.x) > fuzzy_r) || (Math.abs(y - this.y) > fuzzy_r)) {
            return false;
        }
        // Check the actual circle.
        var d_sq = Math.pow(x - this.x, 2) + Math.pow(y - this.y, 2);
        return d_sq < Math.pow(fuzzy_r, 2);
    }
}

function Line(board, n1, n2) {
    this.type = "line";
    this.board = board;
    this.n1 = n1;
    this.n2 = n2;
    this.notes = [];

    board.drawers.push(this);

    this.draw = function() {
        var ctx = board.ctx;
        ctx.save();
        ctx.strokeStyle = 'rgb(0,0,0)';
        ctx.strokeWeight = 2;

        ctx.moveTo(this.n1.x, this.n1.y);
        ctx.lineTo(this.n2.x, this.n2.y);
        ctx.stroke();

        var text_x = (this.n1.x + this.n2.x) / 2;
        var text_y = (this.n1.y + this.n2.y) / 2;
        if (this.n1.x == this.n2.x) {
            var slope = NaN;
        } else {
            var slope = (this.n1.y - this.n2.y) / (this.n1.x - this.n2.x)
        }

        if (slope > 0) {
            var per_line = -14;
        } else {
            var per_line = 14;
        }
        text_x += Math.abs(per_line / 2);
        text_y += per_line / 2;
        for (var i=0; i<this.notes.length; i++) {
            ctx.fillText(this.notes[i], text_x, text_y);
            text_y += per_line;
        }

        ctx.restore();
    }

    this.hit_test = function() {
        return false;
    }

    this.remove = function() {
        var idx = this.board.drawers.indexOf(this);
        if (idx != -1) {
            this.board.drawers.splice(idx, 1); // remove if found
        }
        return null;
    }
}

function ArrowTool(board) {
    this.type = "arrow-tool";
    this.board = board;

    this.drag_offset_x = 0;
    this.drag_offset_y = 0;

    var arrow_tool = this;

    this.elem = $('<div class="tool" id="tool_arrow">Arrow</div>')
        .appendTo('#tools')
        .bind('click', function() {
            arrow_tool.board.set_tool(arrow_tool);
        });

    this.mousedown = function(){};
    this.mouseup = function(){};
    this.mousemove = function(){};
    this.click = function(e, target) {
        var selected_objs = []
        for (var i=0; i<board.drawers.length; i++) {
            if (board.drawers[i].selected) {
                selected_objs.push(board.drawers[i]);
            }
        }
        if (target) {
            var should_select = !target.selected;
            if (!e.shiftKey) {
                if (selected_objs.length > 1 && target.selected) {
                    should_select = true;
                }
                for (var i=0; i<selected_objs.length; i++) {
                    selected_objs[i].selected = false;
                }
            }
            target.selected = should_select;
        } else {
            for (var i=0; i<selected_objs.length; i++) {
                selected_objs[i].selected = false;
            }
        }
    };
    this.dragstart = function(e, target) {
        if (target) {
            this.last_drag_x = e.real_x;
            this.last_drag_y = e.real_y;

            // If we clicked on a non-selected element, unselect everything and
            // select it.
            if (!target.selected) {
                for (var i=0; i<this.board.drawers.length; i++) {
                    this.board.drawers[i].selected = false;
                }
                target.selected = true;
            }

            // Make snapping cool.
            if (this.board.snap) {
                var p = this.board.snap_to(target.x, target.y);
                for (var i=0; i<this.board.drawers.length; i++) {
                    var it = this.board.drawers[i];
                    if (it.selected) {
                        it.x += p.x - target.x;
                        it.y += p.y - target.y;
                    }
                }
                target.x = p.x;
                target.y = p.y;
            }
        }
    };
    this.drag = function(e, target) {
        if (target) {
            var dx = e.real_x - this.last_drag_x;
            var dy = e.real_y - this.last_drag_y;

            if (board.snap) {
                dx -= dx % board.snap_size;
                dy -= dy % board.snap_size;
            }

            for (var i=0; i<board.drawers.length; i++) {
                if (this.board.drawers[i].selected) {
                    this.board.drawers[i].x += dx;
                    this.board.drawers[i].y += dy;
                }
            }

            this.last_drag_x += dx;
            this.last_drag_y += dy;
        }
    };
    this.dragend = function(){};
}

function NodeTool(board) {
    this.type = "node-tool";
    this.board = board;

    // `this` is overwritten in jquery callbacks, so save it here.
    var node_tool = this;

    this.elem = $('<div class="tool" id="tool_node">Nodes</div>')
        .appendTo('#tools')
        .bind('click', function() {
            node_tool.board.set_tool(node_tool);
        });

    this.mousedown = function(){};
    this.mouseup = function(){};
    this.mousemove = function(){};
    this.click = function(e) {
        var p = this.board.snap_to(e.real_x, e.real_y);
        var x = p.x;
        var y = p.y;

        new Node(this.board, x, y);
    };
    this.dragstart = function(){};
    this.drag = function(){};
    this.dragend = function(){};
}

function LineTool(board) {
    this.type = "line-tool";
    this.board = board;

    // `this` is overwritten in jquery callbacks, so save it here.
    var node_tool = this;

    this.temp_end_node = null
    this.temp_line = null;

    // Set the kind of line to make, so sub classes can overwrite it.
    this.line_kind = Line;

    this.elem = $('<div class="tool" id="tool_line">Lines</div>')
        .appendTo('#tools')
        .bind('click', function() {
            node_tool.board.set_tool(node_tool);
        });

    this.mousedown = function(e, target) {};
    this.mouseup = function() {}
    this.click = function(e) {}
    this.mousemove = function(e) {}
    this.dragstart = function(e, target) {;
        if (this.temp_line) {
            // Why do we still have one of these?
            this.temp_line.remove();
            this.temp_line = null;
        }
        if (target && target.type == "node") {
            this.temp_end_node = {'x': e.real_x, 'y': e.real_y};
            this.temp_line = new this.line_kind(this.board, target, this.temp_end_node);
        }
    }
    this.drag = function(e, target) {
        if (this.temp_end_node) {
            this.temp_end_node.x = e.real_x;
            this.temp_end_node.y = e.real_y;
        }
    };
    this.dragend = function(e) {
        var hit = false;
        for (var i=0; i<this.board.drawers.length; i++) {
            var it = this.board.drawers[i];
            if (it.type == 'node' && it.hit_test(e.real_x, e.real_y)) {
                if (it != this.temp_line.n1) {
                    this.temp_line.n2 = it;
                    hit = true;
                }
                break;
            }
        }
        if (!hit) {
            this.temp_line.remove();
        }
        this.temp_line = null;
        this.temp_end_node = null;
    }
}
