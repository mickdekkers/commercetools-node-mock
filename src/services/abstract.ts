import { Update } from '@commercetools/platform-sdk';
import { ParsedQs } from 'qs';
import { Request, Response, Router } from 'express';
import AbstractRepository from '../repositories/abstract';

export default abstract class AbstractService {
  protected abstract getBasePath(): string;
  public abstract repository: AbstractRepository;

  constructor(parent: Router) {
    this.registerRoutes(parent);
  }

  extraRoutes(router: Router) {}

  registerRoutes(parent: Router) {
    const basePath = this.getBasePath();
    const router = Router();

    // Bind this first since the `/:id` routes are currently a bit to greedy
    this.extraRoutes(router);

    router.get('/', this.get.bind(this));
    router.get('/:id', this.getWithId.bind(this));
    router.get('/key=:key', this.getWithKey.bind(this));

    router.delete('/:id', this.deletewithId.bind(this));
    router.delete('/key=:key', this.deletewithKey.bind(this));

    router.post('/', this.post.bind(this));
    router.post('/:id', this.postWithId.bind(this));
    router.post('/key=:key', this.postWithKey.bind(this));

    parent.use(`/${basePath}`, router);
  }

  get(request: Request, response: Response) {
    const result = this.repository.query({
      expand: this._parseParam(request.query.expand),
    });
    return response.status(200).send(result);
  }

  getWithId(request: Request, response: Response) {
    const result = this.repository.get(request.params['id'], {
      expand: this._parseParam(request.query.expand),
    });
    if (!result) {
      return response.status(404).send('Not found');
    }
    return response.status(200).send(result);
  }

  getWithKey(request: Request, response: Response) {
    return response.status(500).send('Not implemented');
  }

  deletewithId(request: Request, response: Response) {
    const result = this.repository.delete(request.params['id']);
    if (!result) {
      return response.status(404).send('Not found');
    }
    return response.status(200).send(result);
  }

  deletewithKey(request: Request, response: Response) {
    return response.status(500).send('Not implemented');
  }

  post(request: Request, response: Response) {
    const draft = request.body;
    const resource = this.repository.create(draft);
    return response.status(200).send(resource);
  }

  postWithId(request: Request, response: Response) {
    const updateRequest: Update = request.body;
    const resource = this.repository.get(request.params['id']);
    if (!resource) {
      return response.status(404).send('Not found');
    }

    if (resource.version != updateRequest.version) {
      return response.status(409).send('Concurrent modification');
    }

    const updatedResource = this.repository.processUpdateActions(
      resource,
      updateRequest.actions
    );
    return response.status(200).send(updatedResource);
  }

  postWithKey(request: Request, response: Response) {
    return response.status(500).send('Not implemented');
  }

  // No idea what i'm doing
  private _parseParam(
    value: string | ParsedQs | string[] | ParsedQs[] | undefined
  ): string[] | undefined {
    if (Array.isArray(value)) {
      // @ts-ignore
      return value;
    } else if (value !== undefined) {
      return [`${value}`];
    }
    return undefined;
  }
}
