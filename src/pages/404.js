import React from 'react';
import Helmet from 'react-helmet';
import { Link } from 'gatsby';
import styled from 'styled-components';
import { Layout, Wrapper, Header } from 'components';
import { media } from '../utils/media';

import config from '../../config/SiteConfig';

const Content = styled.div`
  grid-column: 2;
  box-shadow: 0 4px 120px rgba(0, 0, 0, 0.1);
  border-radius: 1rem;
  padding: 2rem 4rem;
  background-color: ${props => props.theme.colors.bg};
  z-index: 9000;
  margin-top: -3rem;
  @media ${media.tablet} {
    padding: 3rem 3rem;
  }
  @media ${media.phone} {
    padding: 2rem 1.5rem;
  }
  form {
    p {
      label,
      input {
        display: block;
      }
      input {
        min-width: 275px;
        margin-top: 0.5rem;
      }
      textarea {
        resize: vertical;
        min-height: 150px;
        width: 100%;
        margin-top: 0.5rem;
      }
    }
  }
`;

const NotFound = () => (
<Layout>
    <Wrapper>
        <Helmet title={`Page Not Found | ${config.siteTitle}`} />
        <Header>
            <Link to="/">{config.siteTitle}</Link>
        </Header>
        <Content>
            <h1>Page not found</h1>
            <p>Sorry the page you requested was not found. Although I can't help you find what you were looking for, perhaps you can help to find a missing person.</p>
            <iframe src="https://notfound-static.fwebservices.be/en/404?key=5f8c3d99bd9e7" width="100%" height="650" frameborder="0"></iframe>
        </Content>
    </Wrapper>
</Layout>
);

export default NotFound;