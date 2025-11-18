import http from 'http';
import * as fsSync from 'fs';           
import { promises as fs } from 'fs';    
import path from 'path';              
import { Command } from 'commander';
import superagent from 'superagent';
const program = new Command();
program
  .name("WebBack-5")
  .version("1.0.0");

program
  .requiredOption('-h, --host <string>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії кешу');

  program.parse(process.argv)

  const options = program.opts()

  const host = options.host
  const port = parseInt(options.port, 10)
  const cacheDir = options.cache
