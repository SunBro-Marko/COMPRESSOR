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

  @Get('total-size-and-count/')
  getAllFilesTotalSizeAndCount() {
    return this.filesService.getTotalFilesSizeAndCount();
  }

  @Get('total-size-and-count/:type')
  getAllFilesTotalSizeAndCountByType(@Param('type') type: string) {
    return this.filesService.getTotalFilesSizeAndCountByType(type);
  }

  @Get('/download/:id')
  downloadFileById(
    @Param('id') id: string,
    @Response({ passthrough: true }) res,
  ) {
    return this.filesService.downloadFileById(id, res);
  }

  @Get('/restore-file-from-temp/:id')
  restoreFileFromTempbyId(@Param('id') id: string) {
    return this.filesService.restoreFileFromTepmById(id);
  }

  @Get('/compress/:id')
  compressFileById(@Param('id') id: string) {
    return this.filesService.compressFileById(id);
  }

  @Get('/compress-all-by-type/:type')
  compressAllFilesByType(@Param('type') type: string) {
    return this.filesService.compressAllFilesByType(type);
  }

  @Get('/compress-all-by-type/image/jpeg')
  compressAllFilesByTypeJPEG() {
    return this.filesService.compressAllFilesByType('image/jpeg');
  }

  @Put('/initializeCats')
  initializeCats() {
    return this.filesService.UploadAThousandCats();
  }
}
