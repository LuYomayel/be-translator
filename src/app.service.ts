import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

import * as mysql from 'mysql2/promise';
export interface TranslatedWord {
  PalabraUsuario: string;
  Significado: string;
  Clasificacion: string;
  Ejemplo: string;
}
@Injectable()
export class AppService {
  private openai: OpenAI;
  private connectionPool: mysql.Pool;

  apiKey = process.env.OPENAI_API_KEY;

  constructor() {
    this.openai = new OpenAI({
      apiKey: this.apiKey,
    });
    this.connectionPool = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'translator',
      waitForConnections: true,
      queueLimit: 0,
    });
  }

  async translate(word: string) {
    try {
      const response = await this.openai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `
              Necesito que hagas explicitamente tres cosas.
              1. Traduce la palabra del ingles al español (argentino/latino). Si tiene mas de un significado agregalos separados por una barra. La traduccion debe estar si o si en español latino/argentino.
              2. clasifícala -> verbo, sustantivo, adjetivo, etc. Tambien puede ser un phrasal verb, o una expresión idiomática.
              3. pon un ejemplo en una oración en ingles corta de no mas de 10 palabras. El ejemplo debe ser una oración que se pueda usar en la vida real y debes escribirlo directamente sin explicar que es un ejemplo. No me podes dar un ejemplo donde no uses la palabra dada por el usuario.
            `,
          },
          { role: 'user', content: word },
        ],
        model: 'gpt-3.5-turbo-1106',
        max_tokens: 50,
      });
      const respuesta = this.procesarRespuesta(
        response.choices[0].message.content,
        word,
      );
      const findPalabra = await this.findPalabra(respuesta);
      if (findPalabra) {
        return findPalabra;
      }
      return respuesta;
    } catch (error) {
      console.error(error);
      throw new Error('Error en la traducción');
    }
  }

  procesarRespuesta(respuesta, palabraUsuario) {
    const partes = respuesta.split(/\d\./).slice(1); // Dividir por los números y quitar el primer elemento vacío
    if (partes.length !== 3) {
      throw new Error(respuesta);
    }
    return {
      PalabraUsuario: palabraUsuario,
      Significado: partes[0].trim(),
      Clasificacion: partes[1].trim(),
      Ejemplo: partes[2].trim(),
    };
  }

  async executeQuery(translatedWord: any): Promise<any> {
    const connection = await this.connectionPool.getConnection();
    try {
      const query =
        'INSERT INTO TranslatedWords (UserID, PalabraUsuario, Significado, Clasificacion, Ejemplo) VALUES (?, ?, ?, ?, ?)';
      const params = [
        1,
        translatedWord.PalabraUsuario,
        translatedWord.Significado,
        translatedWord.Clasificacion,
        translatedWord.Ejemplo,
      ];

      const result = await connection.query(query, params);
      return result;
    } catch (error) {
      console.error('Error al insertar en la base de datos', error);
      throw error;
    }
  }

  async findPalabra(translatedWord: any): Promise<any> {
    const connection = await this.connectionPool.getConnection();
    try {
      console.log('PalabraUsuario 123: ', translatedWord.PalabraUsuario);
      const palabra: any = await connection.query(
        `select * from TranslatedWords where PalabraUsuario = '${translatedWord.PalabraUsuario}'`,
        connection,
      );
      if (palabra[0].length > 0) {
        console.log('Palabra: ', palabra[0][0]);
        const result = {
          PalabraUsuario: palabra[0][0].PalabraUsuario,
          Significado: palabra[0][0].Significado,
          Clasificacion: palabra[0][0].Clasificacion,
          Ejemplo: palabra[0][0].Ejemplo,
        };
        console.log('Palabra: ', palabra[0][0].PalabraUsuario);
        return result;
      }
      return null;
    } catch (error) {
      console.error('Error al mostrar en la base de datos', error);
      throw error;
    }
  }

  async save(translatedWord: any) {
    try {
      const findPalabra = await this.findPalabra(translatedWord);
      if (findPalabra) {
        return findPalabra;
      }
      await this.executeQuery(translatedWord);
      return translatedWord;
    } catch (error) {
      console.error(error);
      throw new Error('Error al guardar la palabra');
    }
  }

  async getWords() {
    try {
      console.log('getWords');
      const connection = await this.connectionPool.getConnection();
      const palabras: any = await connection.query(
        'select * from TranslatedWords',
        connection,
      );
      console.log('Palabras: ', palabras[0]);
      // Sort the array by FechaTraduccion in descending order
      const sorted = palabras[0].sort((a, b) => {
        return (
          new Date(b.FechaTraduccion).getTime() -
          new Date(a.FechaTraduccion).getTime()
        );
      });

      return sorted;
    } catch (error) {
      console.error(error);
      throw new Error('Error al obtener las palabras');
    }
  }
}
