const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/InvariantError');
const NotFoundError = require('../../exceptions/NotFoundError');
const AuthorizationError = require('../../exceptions/AuthorizationError');

class PlaylistsService {
  constructor(collaborationService) {
    this._pool = new Pool();
    this._collaborationService = collaborationService;
  }

  // Playlists
  async addPlaylist({ name, owner }) {
    const id = `playlist-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlists VALUES($1, $2, $3) RETURNING id',
      values: [id, name, owner],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Playlist gagal ditambahkan');
    }

    return result.rows[0].id;
  }

  async getPlaylists(owner) {
    const query = {
      text: `SELECT playlists.id, playlists.name, users.username AS username FROM playlists 
      LEFT JOIN collaborations ON collaborations.playlist_id = playlists.id 
      LEFT JOIN users ON users.id = playlists.owner 
      WHERE playlists.owner = $1 OR collaborations.user_id = $1 
      GROUP BY (playlists.id, users.username)`,
      values: [owner],
    };

    const result = await this._pool.query(query);
    return result.rows;
  }

  async deletePlaylistById(id) {
    const query = {
      text: 'DELETE FROM playlists WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Playlist gagal dihapus. Id tidak ditemukan');
    }
  }

  // Playlist-Songs
  async addSongToPlaylist(playlistId, songId) {
    const querySong = {
      text: 'SELECT * FROM songs WHERE id = $1',
      values: [songId],
    };

    const resultSong = await this._pool.query(querySong);

    if (!resultSong.rowCount) {
      throw new NotFoundError('Lagu tidak ditemukan. Lagu gagal ditambahkan ke dalam playlist');
    }

    const id = `playlist_songs-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlist_songs VALUES ($1, $2, $3) RETURNING id',
      values: [id, playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0]) {
      throw new InvariantError('Lagu gagal ditambahakn ke dalam playlist');
    }
  }

  async getSongsInPlaylist(playlistId) {
    const queryPlaylist = {
      text: `SELECT playlists.id, playlists.name, users.username FROM playlist_songs 
      INNER JOIN playlists ON playlist_songs.playlist_id = playlists.id 
      INNER JOIN users ON playlists.owner = users.id 
      WHERE playlist_id = $1 LIMIT 1`,
      values: [playlistId],
    };

    const querySongs = {
      text: 'SELECT songs.id, songs.title, songs.performer FROM playlist_songs INNER JOIN songs ON playlist_songs.song_id = songs.id WHERE playlist_id = $1',
      values: [playlistId],
    };

    const resultPlaylist = await this._pool.query(queryPlaylist);
    const resultSongs = await this._pool.query(querySongs);

    if (!resultPlaylist.rowCount) {
      throw new NotFoundError('Playlist tidak ditemukan');
    }

    return {
      id: resultPlaylist.rows[0].id,
      name: resultPlaylist.rows[0].name,
      username: resultPlaylist.rows[0].username,
      songs: resultSongs.rows,
    };
  }

  async deleteSongInPlaylist(playlistId, songId) {
    const query = {
      text: 'DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2 RETURNING id',
      values: [playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0]) {
      throw new InvariantError('Lagu gagal dihapus dari playlist');
    }
  }

  // Verification
  async verifyPlaylistOwner(id, owner) {
    const query = {
      text: 'SELECT * FROM playlists WHERE id = $1',
      values: [id],
    };
    const result = await this._pool.query(query);
    if (!result.rowCount) {
      throw new NotFoundError('Playlist tidak ditemukan');
    }
    const playlist = result.rows[0];
    if (playlist.owner !== owner) {
      throw new AuthorizationError('Anda tidak berhak mengakses resource ini');
    }
  }

  async verifyPlaylistAccess(playlistId, userId) {
    try {
      await this.verifyPlaylistOwner(playlistId, userId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      try {
        await this._collaborationService.verifyCollaborator(playlistId, userId);
      } catch {
        throw error;
      }
    }
  }

  async addPlaylistActivity(playlistId, songId, userId, action) {
    const querySong = {
      text: 'SELECT title FROM songs WHERE id = $1',
      values: [songId],
    };
    const resultSong = await this._pool.query(querySong);
    const { title } = resultSong.rows[0];

    const queryUser = {
      text: 'SELECT username FROM users WHERE id = $1',
      values: [userId],
    };
    const resultUser = await this._pool.query(queryUser);
    const { username } = resultUser.rows[0];

    const id = `activity-${nanoid(16)}`;
    const time = new Date().toISOString();

    const query = {
      text: 'INSERT INTO playlist_activities (id, playlist_id, username, title, action, time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      values: [id, playlistId, username, title, action, time],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0]) {
      throw new InvariantError('Playlist activity gagal ditambahkan');
    }
  }

  async getPlaylistActivites(playlistId) {
    const query = {
      text: 'SELECT username, title, action, time FROM playlist_activities WHERE playlist_id = $1',
      values: [playlistId],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Playlist activity gagal ditambahkan');
    }

    return result.rows;
  }
}

module.exports = PlaylistsService;
