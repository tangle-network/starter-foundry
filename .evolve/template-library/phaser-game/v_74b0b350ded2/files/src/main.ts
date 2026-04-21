import Phaser from 'phaser'
import { MainScene } from './scenes/MainScene.js'

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#0b0d10',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 400 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MainScene],
})
