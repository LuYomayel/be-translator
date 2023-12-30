import { Controller, Body, Post, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async get() {
    return await this.appService.getWords();
  }
  @Post()
  async translate(@Body() { text }: { text: string }) {
    return await this.appService.translate(text);
  }
  @Post('save')
  async save(@Body() translatedWord: any) {
    return await this.appService.save(translatedWord);
  }
}
