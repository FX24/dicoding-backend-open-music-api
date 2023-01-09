/* eslint-disable max-len */
const autoBind = require('auto-bind');

class SongsHandler {
  constructor(service, validator) {
    this._service = service;
    this._validator = validator;

    autoBind(this);
  }

  async postSongHandler(request, h) {
    this._validator.validateSongPayload(request.payload);

    const songId = await this._service.addSong(request.payload);

    const response = h.response({
      status: 'success',
      message: 'Lagu berhasil ditambahkan',
      data: {
        songId,
      },
    });
    response.code(201);
    return response;
  }

  async getSongsHandler(request) {
    const { title, performer } = request.query;
    const songs = await this._service.getSongs();

    let filteredSongs = songs;

    if (title) {
      filteredSongs = filteredSongs.filter((song) => song.title.toLowerCase().includes(title.toLowerCase()));
    }
    if (performer) {
      filteredSongs = filteredSongs.filter((song) => song.performer.toLowerCase().includes(performer.toLowerCase()));
    }

    return {
      status: 'success',
      data: {
        songs: filteredSongs,
      },
    };
  }

  async getSongByIdHandler(request) {
    const { id } = request.params;
    const song = await this._service.getSongById(id);
    return {
      status: 'success',
      data: {
        song,
      },
    };
  }

  async putSongByIdHandler(request) {
    this._validator.validateSongPayload(request.payload);
    const { title, year, genre, performer, duration } = request.payload;
    const { id } = request.params;

    await this._service.editSongById(id, {
      title,
      year,
      genre,
      performer,
      duration,
    });

    return {
      status: 'success',
      message: 'Lagu berhasil diperbarui',
    };
  }

  async deleteSongByIdHandler(request) {
    const { id } = request.params;
    await this._service.deleteSongById(id);

    return {
      status: 'success',
      message: 'Lagu berhasil dihapus',
    };
  }
}

module.exports = SongsHandler;
