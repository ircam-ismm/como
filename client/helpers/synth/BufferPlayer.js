"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

class BufferPlayer {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.src = null;
    this.env = null;
    this.output = audioContext.createGain();
  }

  connect(dest) {
    this.output.connect(dest);
  }

  disconnect(dest) {
    this.output.disconnect();
  }

  start(buffer, {
    fadeInDuration = 1,
    loop = true
  } = options) {
    const now = this.audioContext.currentTime;
    const env = this.audioContext.createGain();
    env.connect(this.output);
    env.gain.value = 0;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + fadeInDuration);
    const src = this.audioContext.createBufferSource();
    src.connect(env);
    src.buffer = buffer;
    src.loop = loop;
    src.start(now);
    this.src = src;
    this.env = env;
  }

  stop({
    fadeOutDuration = 1
  } = options) {
    if (this.src && this.env) {
      const now = this.audioContext.currentTime;
      this.env.gain.cancelScheduledValues(now);
      this.env.gain.setValueAtTime(1, now);
      this.env.gain.linearRampToValueAtTime(0, now + fadeOutDuration);
      this.src.stop(now + fadeOutDuration);
      this.src = null;
      this.env = null;
    }
  }

}

var _default = BufferPlayer;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jbGllbnQvaGVscGVycy9zeW50aC9CdWZmZXJQbGF5ZXIuanMiXSwibmFtZXMiOlsiQnVmZmVyUGxheWVyIiwiY29uc3RydWN0b3IiLCJhdWRpb0NvbnRleHQiLCJzcmMiLCJlbnYiLCJvdXRwdXQiLCJjcmVhdGVHYWluIiwiY29ubmVjdCIsImRlc3QiLCJkaXNjb25uZWN0Iiwic3RhcnQiLCJidWZmZXIiLCJmYWRlSW5EdXJhdGlvbiIsImxvb3AiLCJvcHRpb25zIiwibm93IiwiY3VycmVudFRpbWUiLCJnYWluIiwidmFsdWUiLCJzZXRWYWx1ZUF0VGltZSIsImxpbmVhclJhbXBUb1ZhbHVlQXRUaW1lIiwiY3JlYXRlQnVmZmVyU291cmNlIiwic3RvcCIsImZhZGVPdXREdXJhdGlvbiIsImNhbmNlbFNjaGVkdWxlZFZhbHVlcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUNBLE1BQU1BLFlBQU4sQ0FBbUI7QUFDakJDLEVBQUFBLFdBQVcsQ0FBQ0MsWUFBRCxFQUFlO0FBQ3hCLFNBQUtBLFlBQUwsR0FBb0JBLFlBQXBCO0FBQ0EsU0FBS0MsR0FBTCxHQUFXLElBQVg7QUFDQSxTQUFLQyxHQUFMLEdBQVcsSUFBWDtBQUVBLFNBQUtDLE1BQUwsR0FBY0gsWUFBWSxDQUFDSSxVQUFiLEVBQWQ7QUFDRDs7QUFFREMsRUFBQUEsT0FBTyxDQUFDQyxJQUFELEVBQU87QUFDWixTQUFLSCxNQUFMLENBQVlFLE9BQVosQ0FBb0JDLElBQXBCO0FBQ0Q7O0FBRURDLEVBQUFBLFVBQVUsQ0FBQ0QsSUFBRCxFQUFPO0FBQ2YsU0FBS0gsTUFBTCxDQUFZSSxVQUFaO0FBQ0Q7O0FBRURDLEVBQUFBLEtBQUssQ0FBQ0MsTUFBRCxFQUFTO0FBQ1pDLElBQUFBLGNBQWMsR0FBRyxDQURMO0FBRVpDLElBQUFBLElBQUksR0FBRztBQUZLLE1BR1ZDLE9BSEMsRUFHUTtBQUNYLFVBQU1DLEdBQUcsR0FBRyxLQUFLYixZQUFMLENBQWtCYyxXQUE5QjtBQUVBLFVBQU1aLEdBQUcsR0FBRyxLQUFLRixZQUFMLENBQWtCSSxVQUFsQixFQUFaO0FBQ0FGLElBQUFBLEdBQUcsQ0FBQ0csT0FBSixDQUFZLEtBQUtGLE1BQWpCO0FBQ0FELElBQUFBLEdBQUcsQ0FBQ2EsSUFBSixDQUFTQyxLQUFULEdBQWlCLENBQWpCO0FBQ0FkLElBQUFBLEdBQUcsQ0FBQ2EsSUFBSixDQUFTRSxjQUFULENBQXdCLENBQXhCLEVBQTJCSixHQUEzQjtBQUNBWCxJQUFBQSxHQUFHLENBQUNhLElBQUosQ0FBU0csdUJBQVQsQ0FBaUMsQ0FBakMsRUFBb0NMLEdBQUcsR0FBR0gsY0FBMUM7QUFFQSxVQUFNVCxHQUFHLEdBQUcsS0FBS0QsWUFBTCxDQUFrQm1CLGtCQUFsQixFQUFaO0FBQ0FsQixJQUFBQSxHQUFHLENBQUNJLE9BQUosQ0FBWUgsR0FBWjtBQUNBRCxJQUFBQSxHQUFHLENBQUNRLE1BQUosR0FBYUEsTUFBYjtBQUNBUixJQUFBQSxHQUFHLENBQUNVLElBQUosR0FBV0EsSUFBWDtBQUNBVixJQUFBQSxHQUFHLENBQUNPLEtBQUosQ0FBVUssR0FBVjtBQUVBLFNBQUtaLEdBQUwsR0FBV0EsR0FBWDtBQUNBLFNBQUtDLEdBQUwsR0FBV0EsR0FBWDtBQUNEOztBQUVEa0IsRUFBQUEsSUFBSSxDQUFDO0FBQ0hDLElBQUFBLGVBQWUsR0FBRztBQURmLE1BRURULE9BRkEsRUFFUztBQUNYLFFBQUksS0FBS1gsR0FBTCxJQUFZLEtBQUtDLEdBQXJCLEVBQTBCO0FBQ3hCLFlBQU1XLEdBQUcsR0FBRyxLQUFLYixZQUFMLENBQWtCYyxXQUE5QjtBQUVBLFdBQUtaLEdBQUwsQ0FBU2EsSUFBVCxDQUFjTyxxQkFBZCxDQUFvQ1QsR0FBcEM7QUFDQSxXQUFLWCxHQUFMLENBQVNhLElBQVQsQ0FBY0UsY0FBZCxDQUE2QixDQUE3QixFQUFnQ0osR0FBaEM7QUFDQSxXQUFLWCxHQUFMLENBQVNhLElBQVQsQ0FBY0csdUJBQWQsQ0FBc0MsQ0FBdEMsRUFBeUNMLEdBQUcsR0FBR1EsZUFBL0M7QUFDQSxXQUFLcEIsR0FBTCxDQUFTbUIsSUFBVCxDQUFjUCxHQUFHLEdBQUdRLGVBQXBCO0FBRUEsV0FBS3BCLEdBQUwsR0FBVyxJQUFYO0FBQ0EsV0FBS0MsR0FBTCxHQUFXLElBQVg7QUFDRDtBQUNGOztBQXJEZ0I7O2VBd0RKSixZIiwic291cmNlc0NvbnRlbnQiOlsiXG5jbGFzcyBCdWZmZXJQbGF5ZXIge1xuICBjb25zdHJ1Y3RvcihhdWRpb0NvbnRleHQpIHtcbiAgICB0aGlzLmF1ZGlvQ29udGV4dCA9IGF1ZGlvQ29udGV4dDtcbiAgICB0aGlzLnNyYyA9IG51bGw7XG4gICAgdGhpcy5lbnYgPSBudWxsO1xuXG4gICAgdGhpcy5vdXRwdXQgPSBhdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuICB9XG5cbiAgY29ubmVjdChkZXN0KSB7XG4gICAgdGhpcy5vdXRwdXQuY29ubmVjdChkZXN0KTtcbiAgfVxuXG4gIGRpc2Nvbm5lY3QoZGVzdCkge1xuICAgIHRoaXMub3V0cHV0LmRpc2Nvbm5lY3QoKTtcbiAgfVxuXG4gIHN0YXJ0KGJ1ZmZlciwge1xuICAgIGZhZGVJbkR1cmF0aW9uID0gMSxcbiAgICBsb29wID0gdHJ1ZSxcbiAgfSA9IG9wdGlvbnMpIHtcbiAgICBjb25zdCBub3cgPSB0aGlzLmF1ZGlvQ29udGV4dC5jdXJyZW50VGltZTtcblxuICAgIGNvbnN0IGVudiA9IHRoaXMuYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgICBlbnYuY29ubmVjdCh0aGlzLm91dHB1dCk7XG4gICAgZW52LmdhaW4udmFsdWUgPSAwO1xuICAgIGVudi5nYWluLnNldFZhbHVlQXRUaW1lKDAsIG5vdyk7XG4gICAgZW52LmdhaW4ubGluZWFyUmFtcFRvVmFsdWVBdFRpbWUoMSwgbm93ICsgZmFkZUluRHVyYXRpb24pO1xuXG4gICAgY29uc3Qgc3JjID0gdGhpcy5hdWRpb0NvbnRleHQuY3JlYXRlQnVmZmVyU291cmNlKCk7XG4gICAgc3JjLmNvbm5lY3QoZW52KTtcbiAgICBzcmMuYnVmZmVyID0gYnVmZmVyO1xuICAgIHNyYy5sb29wID0gbG9vcDtcbiAgICBzcmMuc3RhcnQobm93KTtcblxuICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIHRoaXMuZW52ID0gZW52O1xuICB9XG5cbiAgc3RvcCh7XG4gICAgZmFkZU91dER1cmF0aW9uID0gMSxcbiAgfSA9IG9wdGlvbnMpIHtcbiAgICBpZiAodGhpcy5zcmMgJiYgdGhpcy5lbnYpIHtcbiAgICAgIGNvbnN0IG5vdyA9IHRoaXMuYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lO1xuXG4gICAgICB0aGlzLmVudi5nYWluLmNhbmNlbFNjaGVkdWxlZFZhbHVlcyhub3cpO1xuICAgICAgdGhpcy5lbnYuZ2Fpbi5zZXRWYWx1ZUF0VGltZSgxLCBub3cpO1xuICAgICAgdGhpcy5lbnYuZ2Fpbi5saW5lYXJSYW1wVG9WYWx1ZUF0VGltZSgwLCBub3cgKyBmYWRlT3V0RHVyYXRpb24pO1xuICAgICAgdGhpcy5zcmMuc3RvcChub3cgKyBmYWRlT3V0RHVyYXRpb24pO1xuXG4gICAgICB0aGlzLnNyYyA9IG51bGw7XG4gICAgICB0aGlzLmVudiA9IG51bGw7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1ZmZlclBsYXllcjtcbiJdfQ==