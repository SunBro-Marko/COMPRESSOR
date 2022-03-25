import { Controller, Get, Param, Put, Response } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FilesService } from './files.service';

@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  getAllFiles() {
    return this.filesService.getAllFilesDocuments();
  }

  @Get('/file-types')
  getAllFilesTypes() {
    return this.filesService.getAllFileTypes();
  }

  @Get('/download/:id')
  downloadFileById(
    @Param('id') id: string,
    @Response({ passthrough: true }) res,
  ) {
    return this.filesService.downloadFileById(id, res);
  }

  @Get('/compress/:id')
  compressFileById(@Param('id') id: string) {
    return this.filesService.compressFileById(id);
  }

  @Put('/initializeCats')
  initializeCats() {
    return this.filesService.UploadAThousandCats();
  }
}
