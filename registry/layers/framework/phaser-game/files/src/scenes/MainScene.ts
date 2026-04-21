import Phaser from 'phaser'

export class MainScene extends Phaser.Scene {
  private sprite?: Phaser.Physics.Arcade.Sprite
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys

  constructor() {
    super({ key: 'MainScene' })
  }

  preload(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0x6ea8ff, 1)
    g.fillCircle(24, 24, 24)
    g.generateTexture('ball', 48, 48)
    g.destroy()
  }

  create(): void {
    this.add.text(24, 24, 'Starter Foundry — Phaser', { color: '#d5deeb', fontSize: '18px' })

    const ball = this.physics.add.sprite(480, 120, 'ball')
    ball.setBounce(0.85)
    ball.setCollideWorldBounds(true)
    ball.setVelocity(Phaser.Math.Between(-180, 180), 60)
    this.sprite = ball

    this.cursors = this.input.keyboard?.createCursorKeys()
  }

  update(_time: number, delta: number): void {
    if (!this.sprite || !this.cursors) return
    const impulse = (delta / 1000) * 900
    if (this.cursors.left?.isDown) this.sprite.setVelocityX(this.sprite.body!.velocity.x - impulse)
    if (this.cursors.right?.isDown) this.sprite.setVelocityX(this.sprite.body!.velocity.x + impulse)
    if (this.cursors.up?.isDown && (this.sprite.body as Phaser.Physics.Arcade.Body).blocked.down) this.sprite.setVelocityY(-400)
  }
}
